import { applyEvent, type ReducerMap } from '../eventsourcing/domain-event.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { GalaxyEvent } from '../galaxy/galaxy-events.ts';
import { galaxyReducers } from '../galaxy/galaxy-reducers.ts';
import type { ActionEvent } from '../action/action-events.ts';
import { actionReducers } from '../action/action-reducers.ts';
import type { EconomyEvent } from '../economy/economy-events.ts';
import { economyReducers } from '../economy/economy-reducers.ts';
import type { PhaseEvent } from '../phases/phase-events.ts';
import { phaseReducers } from '../phases/phase-reducers.ts';
import type { StrategyEvent } from '../strategy/strategy-events.ts';
import { strategyReducers } from '../strategy/strategy-reducers.ts';
import type { SetupEvent } from '../setup/setup-events.ts';
import { initialGameState, setupReducers } from '../setup/setup-reducers.ts';
import type { GameState } from './game-state.ts';

/** Alle Events einer Partie. Jede Iteration erweitert diese Union um ihr Modul. */
export type GameEvent =
  SetupEvent | GalaxyEvent | PhaseEvent | StrategyEvent | ActionEvent | EconomyEvent;

const gameReducers: ReducerMap<GameState, GameEvent> = {
  ...setupReducers,
  ...galaxyReducers,
  ...phaseReducers,
  ...strategyReducers,
  ...actionReducers,
  ...economyReducers,
};

/** Wendet ein Event an und erhöht die Version (Indirection über eine zentrale Stelle). */
export function evolveGame(state: GameState, event: GameEvent): GameState {
  const next = applyEvent(gameReducers, state, event);
  return { ...next, version: state.version + 1 };
}

/** Baut den Zustand vollständig aus dem Event-Strom auf (Replay, Reconnect). */
export function replayGame(events: readonly GameEvent[]): Result<GameState, DomainError> {
  const [first, ...rest] = events;
  if (first?.type !== 'GameCreated') {
    return err(domainError('replay.missingCreation', 'Event-Strom beginnt nicht mit GameCreated'));
  }
  return ok(rest.reduce(evolveGame, initialGameState(first)));
}
