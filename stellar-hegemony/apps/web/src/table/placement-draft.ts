import { type PlanetAssignment, type PlanetId, type UnitId, unitId } from '@stellar/domain';
import type { PlacementPlan } from './spec-types.ts';

/*
 * Entwurf einer Zuweisung von Figuren auf Planeten (reine Funktionen): Bombardement und Landung.
 * Eine Figur steht auf höchstens einem Planeten; ohne Zuweisung bleibt sie im Weltraum.
 */

export const placementPlan = (): PlacementPlan => ({
  kind: 'placement',
  assignments: {},
  payment: null,
});

function without(plan: PlacementPlan, unit: UnitId): PlacementPlan {
  if (plan.assignments[unit] === undefined) return plan;
  const assignments = Object.fromEntries(
    Object.entries(plan.assignments).filter(([id]) => id !== unit),
  );
  return { ...plan, assignments };
}

/**
 * Weist eine Figur einem erlaubten Planeten zu; `null` lässt sie im Weltraum. Ein nicht
 * erlaubter Planet ändert nichts.
 */
export function assign(
  plan: PlacementPlan,
  unit: UnitId,
  planet: PlanetId | null,
  legal: readonly PlanetId[],
): PlacementPlan {
  if (planet === null) return without(plan, unit);
  if (!legal.includes(planet) || plan.assignments[unit] === planet) return plan;
  return { ...plan, assignments: { ...plan.assignments, [unit]: planet } };
}

/**
 * Ein Planet wird angetippt: die nächste freie Figur geht dorthin. Ist keine mehr frei, kehrt
 * die letzte Figur dieses Planeten in den Weltraum zurück.
 */
export function assignNext(
  plan: PlacementPlan,
  units: readonly UnitId[],
  planet: PlanetId,
  legal: readonly PlanetId[],
): PlacementPlan {
  if (!legal.includes(planet)) return plan;
  const free = units.find((unit) => plan.assignments[unit] === undefined);
  if (free !== undefined) return assign(plan, free, planet, legal);
  const last = units.filter((unit) => plan.assignments[unit] === planet).at(-1);
  return last === undefined ? plan : without(plan, last);
}

/** Die Zuweisungen, wie die Domain sie erwartet. */
export const assignmentsOf = (plan: PlacementPlan): readonly PlanetAssignment[] =>
  Object.entries(plan.assignments).map(([unit, planet]) => ({ unit: unitId(unit), planet }));

/** Wo eine Figur steht: zugewiesener Planet oder `null` im Weltraum. */
export const assignedTo = (plan: PlacementPlan, unit: UnitId): PlanetId | null =>
  plan.assignments[unit] ?? null;
