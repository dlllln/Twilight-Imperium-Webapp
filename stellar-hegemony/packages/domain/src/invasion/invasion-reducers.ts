import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { PlanetState } from '../planet/planet-state.ts';
import type { PlanetId, UnitId } from '../shared/ids.ts';
import { takeUnits } from '../tactical/tactical-reducers.ts';
import type {
  GroundCombatRoundRolled,
  GroundForcesCommitted,
  InvasionEvent,
  PlanetControlGained,
} from './invasion-events.ts';

type Planets = Record<string, PlanetState>;

function removeUnits(state: GameState, ids: readonly UnitId[]): GameState {
  const systems = { ...state.systems };
  const planets: Planets = { ...state.planets };
  takeUnits(systems, planets, new Set(ids));
  return { ...state, systems, planets };
}

function updatePlanet(
  state: GameState,
  id: PlanetId,
  change: (planet: PlanetState) => PlanetState,
): GameState {
  const planet = state.planets[id];
  return planet === undefined
    ? state
    : { ...state, planets: { ...state.planets, [id]: change(planet) } };
}

function commit(state: GameState, event: GroundForcesCommitted): GameState {
  const systems = { ...state.systems };
  const planets: Planets = { ...state.planets };
  const landing = takeUnits(systems, planets, new Set(event.landings.map((l) => l.unit)));
  const landed = { ...state, systems, planets };
  return event.landings.reduce((current, { unit, planet }) => {
    const moved = landing.find((candidate) => candidate.id === unit);
    if (moved === undefined) return current;
    return updatePlanet(current, planet, (p) => ({ ...p, units: [...p.units, moved] }));
  }, landed);
}

function groundRound(state: GameState, event: GroundCombatRoundRolled): GameState {
  const hit = new Set(event.sustained);
  const damaged = updatePlanet(state, event.planet, (planet) => ({
    ...planet,
    units: planet.units.map((unit) => (hit.has(unit.id) ? { ...unit, damaged: true } : unit)),
  }));
  return removeUnits(damaged, event.destroyed);
}

/** RR 59: Ein neu übernommener Planet kommt erschöpft ins Spiel des neuen Besitzers. */
function controlGained(state: GameState, event: PlanetControlGained): GameState {
  const cleared = removeUnits(state, event.structuresDestroyed);
  return updatePlanet(cleared, event.planet, (planet) => ({
    ...planet,
    controller: event.player,
    exhausted: true,
  }));
}

export const invasionReducers: ReducerMap<GameState, InvasionEvent> = {
  BombardmentRolled: (state, event) => removeUnits(state, event.destroyed),
  CenterTokenRemoved: (state, event) =>
    updatePlayer({ ...state, centerTokenRemoved: true }, event.player, (player) => ({
      ...player,
      victoryPoints: player.victoryPoints + event.victoryPoints,
    })),
  GroundForcesCommitted: commit,
  SpaceCannonDefenseFired: (state, event) => removeUnits(state, event.destroyed),
  GroundCombatRoundRolled: groundRound,
  GroundCombatEnded: (state) => state,
  PlanetControlGained: controlGained,
};
