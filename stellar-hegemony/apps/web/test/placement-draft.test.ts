import { planetId, unitId } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import {
  assign,
  assignedTo,
  assignmentsOf,
  assignNext,
  placementPlan,
} from '../src/table/placement-draft.ts';

const ALPHA = planetId('alpha');
const BETA = planetId('beta');
const GAMMA = planetId('gamma');
const LEGAL = [ALPHA, BETA];
const ONE = unitId('inf-1');
const TWO = unitId('inf-2');
const UNITS = [ONE, TWO];

describe('Entwurf einer Zuweisung von Figuren auf Planeten', () => {
  it('zu Beginn steht jede Figur im Weltraum', () => {
    const plan = placementPlan();
    expect(plan).toEqual({ kind: 'placement', assignments: {}, payment: null });
    expect(assignedTo(plan, ONE)).toBeNull();
    expect(assignmentsOf(plan)).toEqual([]);
  });

  it('eine Figur geht auf einen erlaubten Planeten und wechselt ihn auch', () => {
    const plan = assign(placementPlan(), ONE, ALPHA, LEGAL);
    expect(assignedTo(plan, ONE)).toBe(ALPHA);
    const moved = assign(plan, ONE, BETA, LEGAL);
    expect(assignmentsOf(moved)).toEqual([{ unit: ONE, planet: BETA }]);
  });

  it('ein nicht erlaubter Planet ändert nichts', () => {
    const plan = placementPlan();
    expect(assign(plan, ONE, GAMMA, LEGAL)).toBe(plan);
    expect(assignNext(plan, UNITS, GAMMA, LEGAL)).toBe(plan);
  });

  it('null schickt die Figur zurück in den Weltraum', () => {
    const plan = assign(placementPlan(), ONE, ALPHA, LEGAL);
    expect(assignedTo(assign(plan, ONE, null, LEGAL), ONE)).toBeNull();
    const empty = placementPlan();
    expect(assign(empty, TWO, null, LEGAL)).toBe(empty);
  });

  it('ein angetippter Planet bekommt die nächste freie Figur', () => {
    const first = assignNext(placementPlan(), UNITS, ALPHA, LEGAL);
    expect(assignmentsOf(first)).toEqual([{ unit: ONE, planet: ALPHA }]);
    const second = assignNext(first, UNITS, BETA, LEGAL);
    expect(assignmentsOf(second)).toEqual([
      { unit: ONE, planet: ALPHA },
      { unit: TWO, planet: BETA },
    ]);
  });

  it('ist keine Figur mehr frei, kehrt die letzte des Planeten in den Weltraum zurück', () => {
    const full = assignNext(assignNext(placementPlan(), UNITS, ALPHA, LEGAL), UNITS, ALPHA, LEGAL);
    expect(assignmentsOf(full)).toHaveLength(2);
    const freed = assignNext(full, UNITS, ALPHA, LEGAL);
    expect(assignmentsOf(freed)).toEqual([{ unit: ONE, planet: ALPHA }]);
    const elsewhere = assignNext(full, UNITS, BETA, LEGAL);
    expect(elsewhere).toBe(full);
  });
});
