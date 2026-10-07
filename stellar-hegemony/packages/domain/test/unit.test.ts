import { describe, expect, it } from 'vitest';
import {
  canBeProduced,
  canMove,
  canSustainDamage,
  countsTowardFleetLimit,
  damageUnit,
  findCapability,
  hasCapacity,
  hasCombat,
  isStructure,
  occupiesCapacity,
  repairUnit,
  requireUnitDefinition,
  unitsOwnedBy,
  unitTypeId,
} from '../src/index.ts';
import { BLUE, catalog, RED, T, unit } from './fixtures.ts';

const definition = (type: (typeof T)[keyof typeof T]) => {
  const found = catalog.find(type);
  if (found === undefined) throw new Error(`fehlt: ${type}`);
  return found;
};

describe('Einheiten (RR 23) über Fähigkeiten statt Typabfragen', () => {
  it('RR 28.1: nur Nicht-Jäger-Schiffe zählen zum Flottenlimit', () => {
    expect(countsTowardFleetLimit(definition(T.cruiser))).toBe(true);
    expect(countsTowardFleetLimit(definition(T.fighter))).toBe(false);
    expect(countsTowardFleetLimit(definition(T.infantry))).toBe(false);
    expect(countsTowardFleetLimit(definition(T.dock))).toBe(false);
  });

  it('RR 43.1: Jäger und Bodentruppen belegen Kapazität, Schiffe nicht', () => {
    expect(occupiesCapacity(definition(T.fighter))).toBe(true);
    expect(occupiesCapacity(definition(T.infantry))).toBe(true);
    expect(occupiesCapacity(definition(T.carrier))).toBe(false);
  });

  it('RR 66: Schadensresistenz ist eine Fähigkeit', () => {
    expect(canSustainDamage(definition(T.battleship))).toBe(true);
    expect(canSustainDamage(definition(T.cruiser))).toBe(false);
  });

  it('Rollen-Interfaces werden aus den Daten erkannt', () => {
    expect(canMove(definition(T.carrier))).toBe(true);
    expect(canMove(definition(T.fighter))).toBe(false);
    expect(hasCapacity(definition(T.carrier))).toBe(true);
    expect(hasCapacity(definition(T.cruiser))).toBe(false);
    expect(hasCombat(definition(T.dock))).toBe(false);
    expect(canBeProduced(definition(T.dock))).toBe(false);
    expect(isStructure(definition(T.battery))).toBe(true);
  });

  it('RR 20: Bombardement-Werte kommen aus der Fähigkeit', () => {
    expect(findCapability(definition(T.battleship), 'bombardment')?.profile).toEqual({
      hitOn: 5,
      dice: 1,
    });
    expect(findCapability(definition(T.cruiser), 'bombardment')).toBeUndefined();
  });

  it('unbekannte Einheitentypen liefern einen Fehler statt einer Exception', () => {
    const result = requireUnitDefinition(catalog, unitTypeId('nope'));
    expect(result.ok ? null : result.error.code).toBe('unit.unknownType');
    expect(requireUnitDefinition(catalog, T.carrier).ok).toBe(true);
    expect(catalog.all()).toHaveLength(7);
  });

  it('RR 66/73: beschädigen und reparieren erzeugt neue Werte', () => {
    const ship = unit(T.battleship);
    const damaged = damageUnit(ship);
    expect(ship.damaged).toBe(false);
    expect(damaged.damaged).toBe(true);
    expect(repairUnit(damaged).damaged).toBe(false);
  });

  it('filtert Einheiten nach Besitzer', () => {
    const mine = unit(T.cruiser, RED);
    expect(unitsOwnedBy([mine, unit(T.cruiser, BLUE)], RED)).toEqual([mine]);
  });
});
