import {
  excessActionCards,
  findPlayer,
  type GameState,
  handCards,
  type HandCard,
  type PlayerId,
  reactionActor,
  type StrategyCardState,
  strategyCardsOf,
  strategyEffectFor,
} from '@stellar/domain';
import { content } from '../store.ts';

/*
 * Die Hand am unteren Bildrand als reine Daten: Welche Karten liegen gerade bereit und
 * welche davon lassen sich jetzt ausspielen. Die Aktionen des Zugs (Strategiekarte nehmen,
 * strategische oder taktische Aktion, Passen) sind Karten wie die Aktionskarten.
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
    };

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

/** Geheimauftrag wählen, auf eine Karte reagieren, über dem Limit ablegen gehen vor. */
export const interrupted = (game: GameState, player: PlayerId): boolean =>
  findPlayer(game, player)?.secretChoice != null ||
  reactionActor(game) === player ||
  excessActionCards(game, player) > 0;

function strategyPicks(game: GameState): readonly HandEntry[] {
  if (game.players.some((player) => player.secretChoice !== null)) return [];
  return Object.values(game.strategyCards)
    .filter((card) => card.holder === null)
    .sort((a, b) => a.initiative - b.initiative)
    .map((card) => ({ kind: 'pick', card, playable: true }));
}

/** Die Möglichkeiten eines normalen Zugs (RR 3): strategisch, taktisch oder passen. */
function turnActions(input: HandInput, actor: PlayerId): readonly HandEntry[] {
  const unused = strategyCardsOf(input.game, actor).filter((card) => !card.exhausted);
  return [
    ...unused.map((card): HandEntry => ({
      kind: 'strategic',
      card,
      playable: strategyEffectFor(card.mechanic) !== undefined,
    })),
    { kind: 'tactical', system: input.selected, playable: input.selected !== null },
    { kind: 'pass', playable: unused.length === 0 },
  ];
}

const freeTurn = (game: GameState): boolean => {
  const phase = game.actionPhase;
  return phase?.tactical == null && phase?.secondary == null && phase?.transaction == null;
};

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

/** Alle Karten der Hand: erst die Aktionen des Zugs, dann die Aktionskarten. */
export const handEntries = (input: HandInput): readonly HandEntry[] => [
  ...turnEntries(input),
  ...actionEntries(input.game, input.viewer),
];

/** Fester Schlüssel je Karte, damit Ein- und Ausflug der Karten stimmen. */
export function entryKey(entry: HandEntry): string {
  if (entry.kind === 'pick' || entry.kind === 'strategic') return `${entry.kind}-${entry.card.id}`;
  if (entry.kind === 'action') return `action-${entry.player}-${entry.card.definition.id}`;
  return entry.kind;
}
