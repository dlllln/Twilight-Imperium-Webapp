import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { PlanetState } from '../planet/planet-state.ts';
import type { HomeEvent, HomeSystemPlaced } from './home-events.ts';

function controlledPlanets(event: HomeSystemPlaced): Record<string, PlanetState> {
  const planets: Record<string, PlanetState> = {};
  for (const id of event.system.planetIds) {
    const units = event.planets.find((entry) => entry.planet === id)?.units ?? [];
    planets[id] = { id, controller: event.player, exhausted: false, units };
  }
  return planets;
}

function placeHomeSystem(state: GameState, event: HomeSystemPlaced): GameState {
  const unitCount =
    event.spaceUnits.length + event.planets.reduce((sum, entry) => sum + entry.units.length, 0);
  const system = { ...event.system, spaceUnits: event.spaceUnits, commandTokens: [] };
  return {
    ...state,
    systems: { ...state.systems, [system.id]: system },
    planets: { ...state.planets, ...controlledPlanets(event) },
    nextUnitNumber: state.nextUnitNumber + unitCount,
  };
}

export const homeReducers: ReducerMap<GameState, HomeEvent> = {
  HomeSystemPlaced: placeHomeSystem,
  FactionAbilitiesGranted: (state, event) =>
    updatePlayer(state, event.player, (player) => ({ ...player, factionRules: event.rules })),
};
