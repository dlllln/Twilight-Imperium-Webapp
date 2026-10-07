import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import type { GameState } from '../game/game-state.ts';
import type { StrategyCardState } from '../strategy/strategy-card.ts';
import type { GameStarted, PhaseEvent } from './phase-events.ts';

function startGame(state: GameState, event: GameStarted): GameState {
  const strategyCards: Record<string, StrategyCardState> = {};
  for (const card of event.strategyCards) {
    strategyCards[card.id] = { ...card, holder: null, exhausted: false, tradeGoods: 0 };
  }
  return { ...state, speaker: event.speaker, strategyCards };
}

export const phaseReducers: ReducerMap<GameState, PhaseEvent> = {
  GameStarted: startGame,
  StrategyPhaseStarted: (state, event) => ({
    ...state,
    phase: 'strategy',
    round: event.round,
    pickQueue: event.pickQueue,
    actionPhase: null,
  }),
  ActionPhaseStarted: (state, event) => ({
    ...state,
    phase: 'action',
    pickQueue: [],
    actionPhase: {
      order: event.order,
      active: event.order[0] ?? null,
      passed: [],
      secondary: null,
      tactical: null,
    },
  }),
  StatusPhaseStarted: (state, event) => ({
    ...state,
    phase: 'status',
    round: event.round,
    actionPhase: null,
  }),
};
