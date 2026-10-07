import type { SystemState } from '../galaxy/system-state.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlanetId, SystemId, UnitId } from '../shared/ids.ts';
import type { Unit } from '../unit/unit.ts';

/** Wo eine Einheit gerade steht: Weltraumbereich (planet = null) oder Planet. */
export interface UnitLocation {
  readonly unit: Unit;
  readonly system: SystemId;
  readonly planet: PlanetId | null;
}

function onPlanets(state: GameState, system: SystemState, id: UnitId): UnitLocation | undefined {
  for (const planetId of system.planetIds) {
    const unit = state.planets[planetId]?.units.find((candidate) => candidate.id === id);
    if (unit !== undefined) return { unit, system: system.id, planet: planetId };
  }
  return undefined;
}

/** Sucht eine Einheit auf dem gesamten Spielplan. */
export function locateUnit(state: GameState, id: UnitId): UnitLocation | undefined {
  for (const system of Object.values(state.systems)) {
    const unit = system.spaceUnits.find((candidate) => candidate.id === id);
    if (unit !== undefined) return { unit, system: system.id, planet: null };
    const landed = onPlanets(state, system, id);
    if (landed !== undefined) return landed;
  }
  return undefined;
}
