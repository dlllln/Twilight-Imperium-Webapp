import {
  EXPLORATION_DECKS,
  findPlanetDefinition,
  findPlayer,
  type FragmentKind,
  type GameState,
  handCards,
  type HandCard,
  leadersOf,
  type OwnedLeader,
  type OwnedRelic,
  type PlanetId,
  type PlayerId,
  purgeOptions,
  type StrategyCardState,
  strategyCardsOf,
  strategyEffectFor,
  timingOpen,
  usableLeaders,
  usableLegendaryPlanets,
  usableRelics,
} from '@stellar/domain';
import { content } from '../store.ts';
import { canActivateNow } from '../table/legal-systems.ts';
import { freeTurn, interrupted } from './turn-guards.ts';

export { freeTurn, interrupted } from './turn-guards.ts';

/*
 * Die Hand am unteren Bildrand als reine Daten: Welche Karten liegen gerade bereit und
 * welche davon lassen sich jetzt ausspielen. Die Aktionen des Zugs (Strategiekarte nehmen,
 * strategische oder taktische Aktion, Passen) sind Karten wie die Aktionskarten. Dazu kommen
 * die PoK-Karten vor dem Spieler: Relikte, Reliktfragmente und legendäre Planeten.
 */

export type HandEntry =
  | { readonly kind: 'pick'; readonly card: StrategyCardState; readonly playable: boolean }
  | { readonly kind: 'strategic'; readonly card: StrategyCardState; readonly playable: boolean }
  | { readonly kind: 'tactical'; readonly system: string | null; readonly playable: boolean }
  | { readonly kind: 'pass'; readonly playable: boolean }
  | {
      readonly kind: 'action';
      readonly card: HandCard;
      readonly player: PlayerId;
      readonly playable: boolean;
    }
  | {
      readonly kind: 'relic';
      readonly relic: OwnedRelic;
      readonly player: PlayerId;
      readonly playable: boolean;
    }
  | {
      readonly kind: 'fragment';
      readonly fragment: FragmentKind;
      readonly count: number;
      /** Drei Fragmente, die beim Ausspielen geopfert werden; `null`, wenn es keine Dreiergruppe gibt. */
      readonly purge: readonly FragmentKind[] | null;
      readonly player: PlayerId;
      readonly playable: boolean;
    }
  | {
      readonly kind: 'leader';
      readonly leader: OwnedLeader;
      readonly player: PlayerId;
      readonly playable: boolean;
    }
  | {
      readonly kind: 'legendary';
      readonly planet: PlanetId;
      readonly used: boolean;
      readonly player: PlayerId;
      readonly playable: boolean;
    };

/** Die Karten, die vor einem Spieler offen liegen (Relikte, Fragmente, legendäre Planeten). */
export type TableEntry = Extract<
  HandEntry,
  { kind: 'relic' | 'fragment' | 'legendary' | 'leader' }
>;

export interface HandInput {
  readonly game: GameState;
  /** Wer an diesem Bildschirm gerade am Zug ist (sonst `null`). */
  readonly actor: PlayerId | null;
  /** Wessen Aktionskarten zu sehen sind. */
  readonly viewer: PlayerId | null;
  readonly selected: string | null;
  /** Gerade ausgewählte strategische Aktion: dann zeigt die Seitenleiste ihr Formular. */
  readonly choosing: boolean;
}

function strategyPicks(game: GameState): readonly HandEntry[] {
  if (game.players.some((player) => player.secretChoice !== null)) return [];
  return Object.values(game.strategyCards)
    .filter((card) => card.holder === null)
    .sort((a, b) => a.initiative - b.initiative)
    .map((card) => ({ kind: 'pick', card, playable: true }));
}

/** Die Karte „Taktische Aktion“ prüft dasselbe wie der Knopf am System (RR 89.1). */
const tacticalPlayable = (input: HandInput, actor: PlayerId): boolean =>
  input.selected !== null && canActivateNow(input.game, actor, input.selected, input.choosing);

/** Die Möglichkeiten eines normalen Zugs (RR 3): strategisch, taktisch oder passen. */
function turnActions(input: HandInput, actor: PlayerId): readonly HandEntry[] {
  const unused = strategyCardsOf(input.game, actor).filter((card) => !card.exhausted);
  return [
    ...unused.map((card): HandEntry => ({
      kind: 'strategic',
      card,
      playable: strategyEffectFor(card.mechanic) !== undefined,
    })),
    { kind: 'tactical', system: input.selected, playable: tacticalPlayable(input, actor) },
    { kind: 'pass', playable: unused.length === 0 },
  ];
}

function turnEntries(input: HandInput): readonly HandEntry[] {
  const { game, actor } = input;
  if (actor === null || interrupted(game, actor)) return [];
  if (game.phase === 'strategy') return strategyPicks(game);
  if (game.phase !== 'action' || input.choosing || !freeTurn(game)) return [];
  return turnActions(input, actor);
}

function actionEntries(game: GameState, viewer: PlayerId | null): readonly HandEntry[] {
  if (viewer === null) return [];
  return handCards(game, viewer, content).map((card) => ({
    kind: 'action',
    card,
    player: viewer,
    playable: card.playable,
  }));
}

/** Komponentenaktionen gehen nur im eigenen, freien Zug und nicht mitten in einer Wahl. */
const componentOpen = (input: HandInput, player: PlayerId): boolean =>
  !input.choosing &&
  input.actor === player &&
  !interrupted(input.game, player) &&
  timingOpen(input.game, player, 'action');

function relicEntries(input: HandInput, player: PlayerId): readonly TableEntry[] {
  const owned = findPlayer(input.game, player)?.relics ?? [];
  const usable = componentOpen(input, player) ? usableRelics(input.game, player, content) : [];
  return owned.map((relic) => ({
    kind: 'relic',
    relic,
    player,
    playable: usable.includes(relic.id),
  }));
}

/** Die Dreiergruppe, die eine Fragmentkarte opfert: zuerst die ihrer eigenen Art. */
const purgeFor = (sets: readonly (readonly FragmentKind[])[], kind: FragmentKind) =>
  sets.find((set) => set[0] === kind) ?? sets.find((set) => set.includes(kind)) ?? null;

function fragmentEntries(input: HandInput, player: PlayerId): readonly TableEntry[] {
  const held = findPlayer(input.game, player)?.relicFragments ?? [];
  const open = componentOpen(input, player) && input.game.exploration.relicDeck.length > 0;
  const sets = purgeOptions(input.game, player);
  return EXPLORATION_DECKS.flatMap((fragment) => {
    const count = held.filter((kind) => kind === fragment).length;
    if (count === 0) return [];
    const purge = purgeFor(sets, fragment);
    return [{ kind: 'fragment', fragment, count, purge, player, playable: open && purge !== null }];
  });
}

function legendaryEntries(input: HandInput, player: PlayerId): readonly TableEntry[] {
  const { game } = input;
  const usable = componentOpen(input, player) ? usableLegendaryPlanets(game, player, content) : [];
  return Object.values(game.planets)
    .filter((planet) => planet.controller === player)
    .filter((planet) => findPlanetDefinition(content.tiles, planet.id)?.legendary !== undefined)
    .map((planet) => ({
      kind: 'legendary',
      planet: planet.id,
      used: game.exploration.exhaustedLegendaries.includes(planet.id),
      player,
      playable: usable.includes(planet.id),
    }));
}

/** PoK Anführer mit Komponentenaktion: der Agent immer, der Held, sobald er frei ist. */
const inHand = (leader: OwnedLeader): boolean =>
  leader.kind === 'agent' ||
  (leader.kind === 'hero' && leader.status !== 'locked' && leader.status !== 'purged');

function leaderEntries(input: HandInput, player: PlayerId): readonly TableEntry[] {
  const usable = componentOpen(input, player) ? usableLeaders(input.game, player, content) : [];
  return leadersOf(input.game, player, content)
    .filter(inHand)
    .map(({ id, kind, status }) => ({
      kind: 'leader',
      leader: { id, kind, status },
      player,
      playable: usable.includes(id),
    }));
}

/** Was vor dem eigenen Platz liegt: Relikte, Fragmente, legendäre Planeten, Anführer. */
export function tableEntries(input: HandInput): readonly TableEntry[] {
  const { viewer } = input;
  if (viewer === null) return [];
  return [
    ...relicEntries(input, viewer),
    ...fragmentEntries(input, viewer),
    ...legendaryEntries(input, viewer),
    ...leaderEntries(input, viewer),
  ];
}

/** Alle Karten der Hand: erst die Aktionen des Zugs, dann Aktionskarten, dann PoK-Karten. */
export const handEntries = (input: HandInput): readonly HandEntry[] => [
  ...turnEntries(input),
  ...actionEntries(input.game, input.viewer),
  ...tableEntries(input),
];

/** Unterscheidendes Merkmal einer PoK-Karte: Relikt, Fragmentart oder Planet. */
function tableKey(entry: TableEntry): string {
  switch (entry.kind) {
    case 'relic':
      return entry.relic.id;
    case 'fragment':
      return entry.fragment;
    case 'legendary':
      return entry.planet;
    case 'leader':
      return entry.leader.id;
  }
}

const TABLE_KINDS: ReadonlySet<HandEntry['kind']> = new Set([
  'relic',
  'fragment',
  'legendary',
  'leader',
]);

export const isTable = (entry: HandEntry): entry is TableEntry => TABLE_KINDS.has(entry.kind);

/** Fester Schlüssel je Karte, damit Ein- und Ausflug der Karten stimmen. */
export function entryKey(entry: HandEntry): string {
  if (entry.kind === 'pick' || entry.kind === 'strategic') return `${entry.kind}-${entry.card.id}`;
  if (entry.kind === 'action') return `action-${entry.player}-${entry.card.definition.id}`;
  if (isTable(entry)) return `${entry.kind}-${tableKey(entry)}`;
  return entry.kind;
}
