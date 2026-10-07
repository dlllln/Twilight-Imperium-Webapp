import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import type { GameState } from '../game/game-state.ts';
import { type PlanetState, unclaimedPlanet } from '../planet/planet-state.ts';
import type { GalaxyAssembled, GalaxyEvent, PlacedSystem } from './galaxy-events.ts';
import type { SystemState } from './system-state.ts';

const toSystemState = (placed: PlacedSystem): SystemState => ({
  ...placed,
  spaceUnits: [],
  commandTokens: [],
});

function assemble(state: GameState, event: GalaxyAssembled): GameState {
  const systems: Record<string, SystemState> = {};
  const planets: Record<string, PlanetState> = {};
  for (const placed of event.systems) {
    systems[placed.id] = toSystemState(placed);
    for (const id of placed.planetIds) planets[id] = unclaimedPlanet(id);
  }
  return { ...state, systems, planets, homeSlots: event.homeSlots };
}

export const galaxyReducers: ReducerMap<GameState, GalaxyEvent> = {
  GalaxyAssembled: assemble,
};
