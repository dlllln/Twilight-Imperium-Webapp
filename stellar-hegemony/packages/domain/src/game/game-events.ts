import { applyEvent, type ReducerMap } from '../eventsourcing/domain-event.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { GalaxyEvent } from '../galaxy/galaxy-events.ts';
import { galaxyReducers } from '../galaxy/galaxy-reducers.ts';
import type { SetupEvent } from '../setup/setup-events.ts';
import { initialGameState, setupReducers } from '../setup/setup-reducers.ts';
import type { GameState } from './game-state.ts';

/** Alle Events einer Partie. Jede Iteration erweitert diese Union um ihr Modul. */
export type GameEvent = SetupEvent | GalaxyEvent;

const gameReducers: ReducerMap<GameState, GameEvent> = {
  ...setupReducers,
  ...galaxyReducers,
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
