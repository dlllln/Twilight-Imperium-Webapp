import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlayerState } from '../player/player-state.ts';
import type { GameCreated, PlayerSeated, SetupEvent } from './setup-events.ts';

/** Spielverlauf, der vor dem Spielstart noch leer ist. */
const NOT_STARTED = {
  strategyCards: {},
  pickQueue: [],
  actionPhase: null,
  centerTokenRemoved: false,
  winner: null,
} as const satisfies Partial<GameState>;

/** Ausgangszustand einer Partie aus ihrem ersten Event. */
export function initialGameState(event: GameCreated): GameState {
  return {
    ...NOT_STARTED,
    id: event.gameId,
    config: event.config,
    host: event.host,
    version: 1,
    round: 0,
    phase: 'setup',
    speaker: null,
    players: [],
    systems: {},
    planets: {},
    homeSlots: [],
    nextUnitNumber: 1,
  };
}

function seatPlayer(state: GameState, event: PlayerSeated): GameState {
  const { rules } = state.config;
  const pools = rules.startingCommandPools;
  const player: PlayerState = {
    id: event.playerId,
    name: event.name,
    color: event.color,
    faction: event.faction,
    seat: state.players.length,
    commandPools: pools,
    reinforcementTokens: rules.commandTokensPerPlayer - pools.tactic - pools.fleet - pools.strategy,
    tradeGoods: 0,
    commodities: 0,
    commodityLimit: event.commodityLimit,
    technologies: [],
    victoryPoints: 0,
  };
  return { ...state, players: [...state.players, player] };
}

export const setupReducers: ReducerMap<GameState, SetupEvent> = {
  GameCreated: (_state, event) => initialGameState(event),
  PlayerSeated: seatPlayer,
};
