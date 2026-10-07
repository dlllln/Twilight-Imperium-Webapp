import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import type { GameState } from '../game/game-state.ts';
import type { ProductionEvent, UnitsProduced } from './production-events.ts';

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

export const productionReducers: ReducerMap<GameState, ProductionEvent> = {
  UnitsProduced: produce,
};
