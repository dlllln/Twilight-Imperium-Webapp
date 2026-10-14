import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import { readyExploration } from '../exploration/exploration-reducers.ts';
import type { Unit } from '../unit/unit.ts';
import type { StatusEvent } from './status-events.ts';

/** Der Nächste im laufenden Schritt ist dran. */
const advance = (state: GameState, player: string): GameState =>
  state.statusPhase === null
    ? state
    : {
        ...state,
        statusPhase: {
          ...state.statusPhase,
          waiting: state.statusPhase.waiting.filter((id) => id !== player),
        },
      };

function clearTokens(state: GameState): GameState {
  const onBoard = Object.values(state.systems).flatMap((system) => system.commandTokens);
  const systems = Object.fromEntries(
    Object.entries(state.systems).map(([id, system]) => [id, { ...system, commandTokens: [] }]),
  );
  return {
    ...state,
    systems,
    players: state.players.map((player) => ({
      ...player,
      reinforcementTokens:
        player.reinforcementTokens + onBoard.filter((owner) => owner === player.id).length,
    })),
  };
}

const repaired = (units: readonly Unit[]): readonly Unit[] =>
  units.map((unit) => ({ ...unit, damaged: false }));

const mapValues = <T>(record: Readonly<Record<string, T>>, update: (value: T) => T) =>
  Object.fromEntries(Object.entries(record).map(([id, value]) => [id, update(value)]));

/** RR 73.6–73.8: bereitmachen (auch Relikte und legendäre Marker), reparieren, Karten zurück. */
function endRound(state: GameState): GameState {
  return {
    ...readyExploration(state),
    planets: mapValues(state.planets, (p) => ({
      ...p,
      exhausted: false,
      units: repaired(p.units),
    })),
    systems: mapValues(state.systems, (s) => ({ ...s, spaceUnits: repaired(s.spaceUnits) })),
    strategyCards: mapValues(state.strategyCards, (c) => ({
      ...c,
      holder: null,
      exhausted: false,
    })),
    statusPhase: null,
  };
}

export const statusReducers: ReducerMap<GameState, StatusEvent> = {
  ScoringFinished: (state, event) => advance(state, event.player),
  CommandTokensCleared: clearTokens,
  TokenStepReached: (state) =>
    state.statusPhase === null
      ? state
      : {
          ...state,
          statusPhase: { ...state.statusPhase, step: 'tokens', waiting: state.statusPhase.order },
        },
  CommandTokensAllocated: (state, event) =>
    advance(
      updatePlayer(state, event.player, (player) => ({
        ...player,
        commandPools: event.pools,
        reinforcementTokens: player.reinforcementTokens - event.gained,
      })),
      event.player,
    ),
  RoundEnded: endRound,
};
