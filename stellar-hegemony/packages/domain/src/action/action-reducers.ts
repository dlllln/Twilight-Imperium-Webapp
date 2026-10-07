import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { ActionPhaseState } from '../phases/turn-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import { updateCard } from '../strategy/strategy-reducers.ts';
import type { ActionEvent, SecondaryResolved, StrategicActionPerformed } from './action-events.ts';

function withTurn(
  state: GameState,
  update: (turn: ActionPhaseState) => ActionPhaseState,
): GameState {
  return state.actionPhase === null ? state : { ...state, actionPhase: update(state.actionPhase) };
}

const closeSecondaryFor = (state: GameState, player: PlayerId): GameState =>
  withTurn(state, (turn) => {
    if (turn.secondary === null) return turn;
    const awaiting = turn.secondary.awaiting.filter((id) => id !== player);
    return { ...turn, secondary: awaiting.length === 0 ? null : { ...turn.secondary, awaiting } };
  });

function performStrategicAction(state: GameState, event: StrategicActionPerformed): GameState {
  const exhausted = updateCard(state, event.card, (card) => ({ ...card, exhausted: true }));
  return withTurn(exhausted, (turn) => ({
    ...turn,
    secondary: { card: event.card, awaiting: event.secondaryOrder, free: [] },
  }));
}

function resolveSecondary(state: GameState, event: SecondaryResolved): GameState {
  const paid = event.paidStrategyToken
    ? updatePlayer(state, event.player, (p) => ({
        ...p,
        commandPools: { ...p.commandPools, strategy: p.commandPools.strategy - 1 },
      }))
    : state;
  return closeSecondaryFor(paid, event.player);
}

export const actionReducers: ReducerMap<GameState, ActionEvent> = {
  StrategicActionPerformed: performStrategicAction,
  SecondaryResolved: resolveSecondary,
  SecondaryDeclined: (state, event) => closeSecondaryFor(state, event.player),
  PlayerPassed: (state, event) =>
    withTurn(state, (turn) => ({ ...turn, passed: [...turn.passed, event.player] })),
  TurnEnded: (state, event) =>
    withTurn(state, (turn) => ({ ...turn, active: event.next, secondary: null, tactical: null })),
  SecondaryCostWaived: (state, event) =>
    withTurn(state, (turn) =>
      turn.secondary === null
        ? turn
        : { ...turn, secondary: { ...turn.secondary, free: event.players } },
    ),
};
