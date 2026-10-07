import type { ContentPort } from '../ports/content-port.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import type { ActionCardId, PlayerId } from '../shared/ids.ts';
import type { ActionCardDefinition, ActionTiming, WindowKind } from './action-card-definition.ts';
import { effectUsable, situation } from './card-effects.ts';

type TimingRule = (state: GameState, player: PlayerId) => boolean;

const quiet = (state: GameState) => state.reactionWindow === null && state.pendingPlay === null;

const windowFor =
  (kind: WindowKind): TimingRule =>
  (state, player) =>
    state.pendingPlay === null &&
    state.reactionWindow?.kind === kind &&
    state.reactionWindow.awaiting[0] === player;

/** RR 51: Materialaktion nur als eigene Aktion, wenn nichts anderes mehr offen ist. */
const ownAction: TimingRule = (state, player) => {
  const turn = state.actionPhase;
  return (
    quiet(state) &&
    turn?.active === player &&
    turn.secondary === null &&
    turn.tactical === null &&
    turn.transaction === null
  );
};

/** Wann jede Zeitangabe einer Karte gerade erfüllt ist (Information Expert für den Zeitpunkt). */
const TIMINGS: Readonly<Record<ActionTiming, TimingRule>> = {
  action: ownAction,
  afterActivation: windowFor('afterActivation'),
  combatRound: windowFor('combatRound'),
  invasion: windowFor('invasion'),
  afterHits: (state, player) =>
    quiet(state) &&
    state.actionPhase?.tactical?.pendingHits.some((entry) => entry.player === player) === true,
  secondary: (state, player) => {
    const secondary = state.actionPhase?.secondary;
    return quiet(state) && secondary?.awaiting[0] === player && !secondary.free.includes(player);
  },
  cancel: (state, player) => state.pendingPlay?.awaiting[0] === player,
};

export const timingOpen = (state: GameState, player: PlayerId, timing: ActionTiming): boolean =>
  TIMINGS[timing](state, player);

export const findActionCard = (
  content: ContentPort,
  id: ActionCardId,
): ActionCardDefinition | undefined => content.actionCards.find((card) => card.id === id);

/** Karten der Hand mit dieser Zeitangabe, deren Wirkung gerade möglich wäre. */
export function usableCards(
  state: GameState,
  player: PlayerId,
  timing: ActionTiming,
  content: ContentPort,
): readonly ActionCardDefinition[] {
  const hand = findPlayer(state, player)?.actionCards ?? [];
  return [...new Set(hand)]
    .flatMap((id) => findActionCard(content, id) ?? [])
    .filter((card) => card.timing === timing)
    .filter((card) => effectUsable(situation(state, player, card.effect, content)));
}

/** RR 3.10: in der Aktionsphase ab dem aktiven Spieler in Initiativreihenfolge. */
export function reactionOrder(state: GameState): readonly PlayerId[] {
  const turn = state.actionPhase;
  if (turn === null) return state.players.map((player) => player.id);
  const start = turn.active === null ? 0 : Math.max(0, turn.order.indexOf(turn.active));
  return [...turn.order.slice(start), ...turn.order.slice(0, start)];
}

/** Wer reihum eine Karte mit dieser Zeitangabe spielen könnte (ohne den Ausspielenden). */
export const respondersFor = (
  state: GameState,
  timing: ActionTiming,
  content: ContentPort,
  except: PlayerId | null = null,
): readonly PlayerId[] =>
  reactionOrder(state)
    .filter((player) => player !== except)
    .filter((player) => usableCards(state, player, timing, content).length > 0);
