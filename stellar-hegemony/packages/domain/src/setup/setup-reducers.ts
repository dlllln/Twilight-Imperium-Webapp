import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import type { GameState } from '../game/game-state.ts';
import { NO_ACTION_DECK } from '../action-card/action-card-state.ts';
import { NO_OBJECTIVES, NO_ROUND_STATS } from '../objective/objective-state.ts';
import type { PlayerState } from '../player/player-state.ts';
import type { GameCreated, PlayerSeated, SetupEvent } from './setup-events.ts';

/** Spielverlauf, der vor dem Spielstart noch leer ist. */
const NOT_STARTED = {
  strategyCards: {},
  pickQueue: [],
  actionPhase: null,
  statusPhase: null,
  objectives: NO_OBJECTIVES,
  centerTokenRemoved: false,
  actionDeck: NO_ACTION_DECK,
  reactionWindow: null,
  pendingPlay: null,
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

/** Was jeder Spieler zu Beginn noch nicht hat. */
const FRESH_PLAYER = {
  tradeGoods: 0,
  commodities: 0,
  technologies: [],
  victoryPoints: 0,
  secretObjectives: [],
  secretChoice: null,
  actionCards: [],
  roundStats: NO_ROUND_STATS,
} as const satisfies Partial<PlayerState>;

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
    commodityLimit: event.commodityLimit,
    ...FRESH_PLAYER,
  };
  return { ...state, players: [...state.players, player] };
}

export const setupReducers: ReducerMap<GameState, SetupEvent> = {
  GameCreated: (_state, event) => initialGameState(event),
  PlayerSeated: seatPlayer,
};
