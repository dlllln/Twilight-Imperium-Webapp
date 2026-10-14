import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import type { GameState } from '../game/game-state.ts';
import type {
  ProductionEvent,
  StructuresPlaced,
  UnitsDeployed,
  UnitsProduced,
} from './production-events.ts';

function produce(state: GameState, event: UnitsProduced): GameState {
  const system = state.systems[event.system];
  const planet = event.planet === null ? undefined : state.planets[event.planet];
  const systems =
    system === undefined
      ? state.systems
      : {
          ...state.systems,
          [system.id]: { ...system, spaceUnits: [...system.spaceUnits, ...event.space] },
        };
  const planets =
    planet === undefined
      ? state.planets
      : { ...state.planets, [planet.id]: { ...planet, units: [...planet.units, ...event.ground] } };
  const created = event.space.length + event.ground.length;
  return { ...state, systems, planets, nextUnitNumber: state.nextUnitNumber + created };
}

function placeStructures(state: GameState, event: StructuresPlaced): GameState {
  const planets = { ...state.planets };
  for (const { planet, unit } of event.placements) {
    const target = planets[planet];
    if (target !== undefined) planets[planet] = { ...target, units: [...target.units, unit] };
  }
  return { ...state, planets, nextUnitNumber: state.nextUnitNumber + event.placements.length };
}

/** Eingesetzte Einheiten stehen auf dem Planeten; die Ids zählen wie produzierte weiter. */
function deploy(state: GameState, event: UnitsDeployed): GameState {
  const target = state.planets[event.planet];
  const planets =
    target === undefined
      ? state.planets
      : { ...state.planets, [target.id]: { ...target, units: [...target.units, ...event.units] } };
  return { ...state, planets, nextUnitNumber: state.nextUnitNumber + event.units.length };
}

export const productionReducers: ReducerMap<GameState, ProductionEvent> = {
  UnitsProduced: produce,
  StructuresPlaced: placeStructures,
  UnitsDeployed: deploy,
};
