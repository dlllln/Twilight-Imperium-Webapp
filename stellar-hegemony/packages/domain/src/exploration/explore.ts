import { shipsOf } from '../combat/combat-queries.ts';
import type { DecisionContext } from '../eventsourcing/command.ts';
import { findPlanetDefinition } from '../economy/payment.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import { systemOfPlanet } from '../objective/board-queries.ts';
import type { ContentPort } from '../ports/content-port.ts';
import { shuffle } from '../ports/random-port.ts';
import type { ExplorationCardId, PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import type {
  ExplorationCardDefinition,
  ExplorationDeckKind,
  ExplorationEffect,
} from './exploration-definition.ts';
import type { ExplorationDeckReshuffled } from './exploration-events.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import { rewardEvents, type RewardInput } from './reward-effects.ts';

interface Draw {
  readonly reshuffled: readonly ExplorationDeckReshuffled[];
  readonly card: ExplorationCardId;
}

/** Oberste Karte des Stapels; ist er leer, wird zuerst die Ablage gemischt. */
export function drawExploration(
  state: GameState,
  deck: ExplorationDeckKind,
  random: DecisionContext['random'],
): Draw | null {
  const top = state.exploration.decks[deck][0];
  if (top !== undefined) return { reshuffled: [], card: top };
  const cards = shuffle(random, state.exploration.discards[deck]);
  const first = cards[0];
  return first === undefined
    ? null
    : { reshuffled: [{ type: 'ExplorationDeckReshuffled', deck, cards }], card: first };
}

export const findExplorationCard = (
  content: Pick<ContentPort, 'explorationCards'>,
  id: ExplorationCardId,
): ExplorationCardDefinition | undefined => content.explorationCards.find((card) => card.id === id);

interface CardInput extends RewardInput {
  readonly system: SystemId;
  readonly card: ExplorationCardDefinition;
}

type Of<K extends ExplorationEffect['kind']> = Extract<ExplorationEffect, { kind: K }>;

const discarded = ({ card }: CardInput): GameEvent => ({
  type: 'ExplorationCardDiscarded',
  deck: card.deck,
  card: card.id,
});

/** Anlage bleibt auf dem Planeten; ohne Planet (Grenzkarte) verfällt sie auf die Ablage. */
function attachmentEvents(input: CardInput, effect: Of<'attachment'>): readonly GameEvent[] {
  if (input.planet === null) return [discarded(input)];
  const { resources, influence, specialty } = effect;
  const attachment = { card: input.card.id, resources, influence };
  return [
    {
      type: 'AttachmentAdded',
      planet: input.planet,
      attachment: specialty === undefined ? attachment : { ...attachment, specialty },
    },
  ];
}

/** Wirkung der aufgedeckten Karte; Anlagen und Fragmente bleiben im Spiel, der Rest geht ab. */
function cardEvents(input: CardInput): readonly GameEvent[] {
  const { effect } = input.card;
  if (effect.kind === 'attachment') return attachmentEvents(input, effect);
  if (effect.kind === 'relicFragment')
    return [{ type: 'RelicFragmentGained', player: input.player, fragment: input.card.deck }];
  const resolved: readonly GameEvent[] =
    effect.kind === 'tradeGoodsCache'
      ? [{ type: 'TradeGoodsCachePlaced', system: input.system, amount: effect.amount }]
      : rewardEvents(input, effect);
  return [...resolved, discarded(input)];
}

interface Exploration {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly planet: PlanetId | null;
  readonly system: SystemId;
  readonly drawn: readonly GameEvent[];
  readonly card: ExplorationCardId;
}

/** Erst ziehen, dann die Karte im Zustand danach abhandeln (Einheiten-Ids, Aktionsstapel). */
function resolveDrawn(exploration: Exploration, context: DecisionContext): readonly GameEvent[] {
  const { drawn, card: id, player, planet, system } = exploration;
  const card = findExplorationCard(context.content, id);
  if (card === undefined) return drawn;
  const state = drawn.reduce(evolveGame, exploration.state);
  const { content, random } = context;
  const input = { state, player, planet, system, card, source: id, content, random };
  return [...drawn, ...cardEvents(input)];
}

/**
 * PoK Erkundung: Wer einen Planeten übernimmt, den vorher niemand kontrolliert hat, deckt
 * die oberste Karte des Stapels seiner Eigenschaft auf. Planeten ohne Eigenschaft nicht.
 */
export function explorePlanetEvents(
  state: GameState,
  player: PlayerId,
  planet: PlanetId,
  context: DecisionContext,
): readonly GameEvent[] {
  const trait = findPlanetDefinition(context.content.tiles, planet)?.trait;
  const system = systemOfPlanet(state, planet)?.id;
  if (trait === undefined || system === undefined) return [];
  const draw = drawExploration(state, trait, context.random);
  if (draw === null) return [];
  const { card } = draw;
  const drawn = [
    ...draw.reshuffled,
    { type: 'PlanetExplored', player, planet, deck: trait, card } as const,
  ];
  return resolveDrawn({ state, player, planet, system, drawn, card }, context);
}

/** PoK Grenzmarker: der Marker verschwindet, die oberste Grenzkarte wirkt im System. */
export function exploreFrontierEvents(
  state: GameState,
  player: PlayerId,
  system: SystemId,
  context: DecisionContext,
): readonly GameEvent[] {
  const draw = drawExploration(state, 'frontier', context.random);
  if (draw === null) return [];
  const { card } = draw;
  const drawn = [...draw.reshuffled, { type: 'FrontierExplored', player, system, card } as const];
  return resolveDrawn({ state, player, planet: null, system, drawn, card }, context);
}

/** PoK Grenzkarte: Wer nach der Bewegung eigene Schiffe im System hat, nimmt das Depot. */
export function collectCache(
  state: GameState,
  player: PlayerId,
  system: SystemId,
  catalog: UnitCatalog,
): readonly GameEvent[] {
  const amount = state.exploration.caches[system] ?? 0;
  if (amount === 0 || shipsOf(state, system, player, catalog).length === 0) return [];
  return [{ type: 'TradeGoodsCacheCollected', player, system, amount }];
}
