import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import { COMMAND_POOLS } from '../player/command-sheet.ts';
import type { PlayerState } from '../player/player-state.ts';
import type { PlanetId } from '../shared/ids.ts';
import type {
  CommandTokenReturned,
  CommandTokensGained,
  CommandTokensPlaced,
  EconomyEvent,
  TokenSource,
} from './economy-events.ts';

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

function setExhausted(state: GameState, ids: readonly PlanetId[], exhausted: boolean): GameState {
  const planets = { ...state.planets };
  for (const id of ids) {
    const planet = planets[id];
    if (planet !== undefined) planets[id] = { ...planet, exhausted };
  }
  return { ...state, planets };
}

export function takeToken(player: PlayerState, source: TokenSource): PlayerState {
  if (source === 'reinforcements')
    return { ...player, reinforcementTokens: player.reinforcementTokens - 1 };
  return {
    ...player,
    commandPools: { ...player.commandPools, [source]: player.commandPools[source] - 1 },
  };
}

function placeTokens(state: GameState, event: CommandTokensPlaced): GameState {
  const system = state.systems[event.system];
  if (system === undefined) return state;
  const placed = event.placements.reduce(
    (current, { player, source }) => updatePlayer(current, player, (p) => takeToken(p, source)),
    state,
  );
  const tokens = [...system.commandTokens, ...event.placements.map(({ player }) => player)];
  return {
    ...placed,
    systems: { ...placed.systems, [system.id]: { ...system, commandTokens: tokens } },
  };
}

/** RR 49.1: der Marker verlässt den Spielplan; wohin er kommt, sagt die Umverteilung. */
function returnToken(state: GameState, event: CommandTokenReturned): GameState {
  const system = state.systems[event.system];
  if (system === undefined) return state;
  const commandTokens = system.commandTokens.filter((id) => id !== event.player);
  return { ...state, systems: { ...state.systems, [system.id]: { ...system, commandTokens } } };
}

export const economyReducers: ReducerMap<GameState, EconomyEvent> = {
  CommandTokensGained: gainTokens,
  PlanetsExhausted: (state, event) => setExhausted(state, event.planets, true),
  PlanetsReadied: (state, event) => setExhausted(state, event.planets, false),
  CommandTokensPlaced: placeTokens,
  TradeGoodsSpent: (state, event) =>
    updatePlayer(state, event.player, (p) => ({ ...p, tradeGoods: p.tradeGoods - event.amount })),
  TradeGoodsGained: (state, event) =>
    updatePlayer(state, event.player, (p) => ({ ...p, tradeGoods: p.tradeGoods + event.amount })),
  CommoditiesReplenished: (state, event) =>
    updatePlayer(state, event.player, (p) => ({ ...p, commodities: p.commodityLimit })),
  CommandTokenReturned: returnToken,
  CommandTokensRedistributed: (state, event) =>
    updatePlayer(state, event.player, (p) => ({ ...p, commandPools: event.pools })),
};
