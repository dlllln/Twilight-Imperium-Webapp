import {
  excessActionCards,
  findPlayer,
  type GameState,
  type PlayerId,
  reactionActor,
  type StrategyCardId,
  type TacticalStep,
  tacticalDecider,
} from '@stellar/domain';

/*
 * Welche Entscheidung gerade am Bildschirm ansteht (reine Funktion). Ansage, Tisch und Karte
 * fragen dieselbe Stelle; der Schlüssel ändert sich mit jeder neuen Entscheidung, damit
 * Entwürfe und Hinweise nie in die nächste Entscheidung hinüberrutschen.
 */

export type DecisionKind =
  | 'gameOver'
  | 'waiting'
  | 'secretChoice'
  | 'reaction'
  | 'discard'
  | 'scoring'
  | 'tokens'
  | 'vote'
  | 'tieBreak'
  | 'secondary'
  | 'transactionReply'
  | 'primary'
  | 'tactical'
  | 'combat'
  | 'idle';

export interface DecisionRoute {
  readonly kind: DecisionKind;
  /** Wer entscheidet; bei 'waiting' die andere Person. */
  readonly actor: PlayerId | null;
  /** Strategiekarte der Primär- oder Sekundärfähigkeit. */
  readonly card: StrategyCardId | null;
  readonly ability: 'primary' | 'secondary' | null;
  readonly step: TacticalStep | null;
  readonly key: string;
}

export interface RouteInput {
  readonly game: GameState;
  /** Wer an diesem Bildschirm jetzt entscheidet. */
  readonly actor: PlayerId | null;
  /** Wer sonst gerade am Zug ist (KI oder Mitspieler). */
  readonly waitingOn: PlayerId | null;
  /** Aus der Hand gewählte strategische Aktion dieses Spielers. */
  readonly chosen: StrategyCardId | null;
}

type Shape = Omit<DecisionRoute, 'key'>;

const plain = (kind: DecisionKind, actor: PlayerId | null): Shape => ({
  kind,
  actor,
  card: null,
  ability: null,
  step: null,
});

/** Was jede Phase unterbricht: Geheimauftrags-Wahl, Reaktion, Ablegen über dem Limit. */
function interruptionOf(game: GameState, actor: PlayerId): DecisionKind | null {
  if (findPlayer(game, actor)?.secretChoice != null) return 'secretChoice';
  if (reactionActor(game) === actor) return 'reaction';
  return excessActionCards(game, actor) > 0 ? 'discard' : null;
}

/** Laufende taktische Aktion: der Verteidiger entscheidet nur im Kampf. */
function tacticalOf(game: GameState, actor: PlayerId): Shape | null {
  const turn = game.actionPhase;
  const tactical = turn?.tactical;
  if (tactical == null) return null;
  const defending = tacticalDecider(game) === actor && actor !== turn?.active;
  return { ...plain(defending ? 'combat' : 'tactical', actor), step: tactical.step };
}

function actionOf(game: GameState, actor: PlayerId, chosen: StrategyCardId | null): Shape | null {
  const turn = game.actionPhase;
  if (turn === null) return null;
  if (turn.secondary !== null)
    return { ...plain('secondary', actor), card: turn.secondary.card, ability: 'secondary' };
  if (turn.transaction !== null) return plain('transactionReply', actor);
  const tactical = tacticalOf(game, actor);
  if (tactical !== null) return tactical;
  if (chosen !== null) return { ...plain('primary', actor), card: chosen, ability: 'primary' };
  return plain('idle', actor);
}

function phaseOf(game: GameState, actor: PlayerId, chosen: StrategyCardId | null): Shape | null {
  if (game.phase === 'status')
    return plain(game.statusPhase?.step === 'tokens' ? 'tokens' : 'scoring', actor);
  if (game.phase === 'agenda')
    return plain(game.agendaPhase?.tied != null ? 'tieBreak' : 'vote', actor);
  return game.phase === 'action' ? actionOf(game, actor, chosen) : null;
}

function shapeOf(input: RouteInput): Shape | null {
  const { game, actor, waitingOn } = input;
  if (game.phase === 'gameOver') return plain('gameOver', null);
  if (waitingOn !== null) return plain('waiting', waitingOn);
  if (actor === null) return null;
  const interruption = interruptionOf(game, actor);
  if (interruption !== null) return plain(interruption, actor);
  return phaseOf(game, actor, input.chosen);
}

type Part = string | number | null | undefined;

const text = (part: Part): string => (part == null ? '' : String(part));

/** Was sich innerhalb einer Phase ändern kann: Statusschritt, Agenda, Gleichstand, Warteschlange. */
function phaseParts(game: GameState): readonly Part[] {
  const agenda = game.agendaPhase;
  return [
    game.statusPhase?.step,
    agenda?.number,
    agenda?.tied?.join(','),
    game.actionPhase?.secondary?.awaiting[0],
  ];
}

/** phase|round|kind|actor|card|step|status.step|agenda.number|tied|awaiting[0] */
function keyOf(game: GameState, shape: Shape): string {
  const own = [game.phase, game.round, shape.kind, shape.actor, shape.card, shape.step];
  return [...own, ...phaseParts(game)].map(text).join('|');
}

/** Die offene Entscheidung; `null`, wenn es am Bildschirm nichts zu entscheiden gibt. */
export function decisionOf(input: RouteInput): DecisionRoute | null {
  const shape = shapeOf(input);
  return shape === null ? null : { ...shape, key: keyOf(input.game, shape) };
}
