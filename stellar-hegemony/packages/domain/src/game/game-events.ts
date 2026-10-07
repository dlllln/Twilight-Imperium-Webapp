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
import type { HomeEvent } from '../faction/home-events.ts';
import { homeReducers } from '../faction/home-reducers.ts';
import type { TacticalEvent } from '../tactical/tactical-events.ts';
import { tacticalReducers } from '../tactical/tactical-reducers.ts';
import type { CombatEvent } from '../combat/combat-events.ts';
import { combatReducers } from '../combat/combat-reducers.ts';
import type { InvasionEvent } from '../invasion/invasion-events.ts';
import { invasionReducers } from '../invasion/invasion-reducers.ts';
import type { ProductionEvent } from '../production/production-events.ts';
import { productionReducers } from '../production/production-reducers.ts';
import type { TransactionEvent } from '../transaction/transaction-events.ts';
import { transactionReducers } from '../transaction/transaction-reducers.ts';
import type { TechnologyEvent } from '../technology/technology-events.ts';
import { technologyReducers } from '../technology/technology-reducers.ts';
import type { ObjectiveEvent } from '../objective/objective-events.ts';
import { objectiveReducers } from '../objective/objective-reducers.ts';
import { trackRoundStats } from '../objective/round-stats.ts';
import type { StatusEvent } from '../status/status-events.ts';
import { statusReducers } from '../status/status-reducers.ts';
import type { ActionCardEvent } from '../action-card/action-card-events.ts';
import type { AgendaEvent } from '../agenda/agenda-events.ts';
import { agendaReducers } from '../agenda/agenda-reducers.ts';
import { actionCardReducers } from '../action-card/action-card-reducers.ts';
import type { GameState } from './game-state.ts';

/** Alle Events einer Partie. Jede Iteration erweitert diese Union um ihr Modul. */
export type GameEvent =
  | SetupEvent
  | GalaxyEvent
  | HomeEvent
  | PhaseEvent
  | StrategyEvent
  | ActionEvent
  | TacticalEvent
  | CombatEvent
  | InvasionEvent
  | ProductionEvent
  | TransactionEvent
  | TechnologyEvent
  | ObjectiveEvent
  | StatusEvent
  | ActionCardEvent
  | AgendaEvent
  | EconomyEvent;

const gameReducers: ReducerMap<GameState, GameEvent> = {
  ...setupReducers,
  ...galaxyReducers,
  ...phaseReducers,
  ...strategyReducers,
  ...actionReducers,
  ...economyReducers,
  ...homeReducers,
  ...tacticalReducers,
  ...combatReducers,
  ...invasionReducers,
  ...productionReducers,
  ...transactionReducers,
  ...technologyReducers,
  ...objectiveReducers,
  ...statusReducers,
  ...actionCardReducers,
  ...agendaReducers,
};

/** Wendet ein Event an und erhöht die Version (Indirection über eine zentrale Stelle). */
export function evolveGame(state: GameState, event: GameEvent): GameState {
  const next = trackRoundStats(state, applyEvent(gameReducers, state, event), event);
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
