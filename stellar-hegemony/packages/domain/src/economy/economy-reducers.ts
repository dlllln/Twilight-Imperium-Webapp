import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import { COMMAND_POOLS } from '../player/command-sheet.ts';
import type { CommandTokensGained, EconomyEvent, PlanetsExhausted } from './economy-events.ts';

function gainTokens(state: GameState, event: CommandTokensGained): GameState {
  const gained = COMMAND_POOLS.reduce((total, pool) => total + event.pools[pool], 0);
  return updatePlayer(state, event.player, (player) => ({
    ...player,
    reinforcementTokens: player.reinforcementTokens - gained,
    commandPools: {
      tactic: player.commandPools.tactic + event.pools.tactic,
      fleet: player.commandPools.fleet + event.pools.fleet,
      strategy: player.commandPools.strategy + event.pools.strategy,
    },
  }));
}

function exhaustPlanets(state: GameState, event: PlanetsExhausted): GameState {
  const planets = { ...state.planets };
  for (const id of event.planets) {
    const planet = planets[id];
    if (planet !== undefined) planets[id] = { ...planet, exhausted: true };
  }
  return { ...state, planets };
}

export const economyReducers: ReducerMap<GameState, EconomyEvent> = {
  CommandTokensGained: gainTokens,
  PlanetsExhausted: exhaustPlanets,
  TradeGoodsSpent: (state, event) =>
    updatePlayer(state, event.player, (p) => ({ ...p, tradeGoods: p.tradeGoods - event.amount })),
  TradeGoodsGained: (state, event) =>
    updatePlayer(state, event.player, (p) => ({ ...p, tradeGoods: p.tradeGoods + event.amount })),
};
