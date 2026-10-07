import { describe, expect, it } from 'vitest';
import {
  canBeProduced,
  countsTowardFleetLimit,
  findCapability,
  validateGameConfig,
} from '@stellar/domain';
import { BASE_RULE_NUMBERS, BASE_UNITS, UNIT_TYPES, unitName } from '../src/index.ts';

const byId = (id: string) => BASE_UNITS.find((unit) => unit.id === id);

describe('Content: Grundwerte der Einheiten', () => {
  it('jede Einheit hat einen deutschen und englischen Namen', () => {
    for (const unit of BASE_UNITS) {
      expect(unitName(unit.id)?.de.length).toBeGreaterThan(0);
      expect(unitName(unit.id)?.en.length).toBeGreaterThan(0);
    }
  });

  it('Ids sind eindeutig', () => {
    expect(new Set(BASE_UNITS.map((unit) => unit.id)).size).toBe(BASE_UNITS.length);
  });

  it('Kampfwerte liegen auf dem W10', () => {
    for (const unit of BASE_UNITS) {
      if (unit.combat === undefined) continue;
      expect(unit.combat.hitOn).toBeGreaterThanOrEqual(1);
      expect(unit.combat.hitOn).toBeLessThanOrEqual(BASE_RULE_NUMBERS.dieSides);
    }
  });

  it('RR 23.2: Materialbeschränkung entspricht dem Grundspiel', () => {
    expect(byId(UNIT_TYPES.carrier)?.componentLimit).toBe(4);
    expect(byId(UNIT_TYPES.dreadnought)?.componentLimit).toBe(5);
    expect(byId(UNIT_TYPES.sunbreaker)?.componentLimit).toBe(2);
    expect(byId(UNIT_TYPES.orbitalDock)?.componentLimit).toBe(3);
    expect(byId(UNIT_TYPES.orbitalBattery)?.componentLimit).toBe(6);
  });

  it('RR 48: Jäger und Infanterie kommen zu zweit für eine Ressource', () => {
    expect(byId(UNIT_TYPES.fighter)?.cost).toEqual({ resources: 1, unitsPerCost: 2 });
    expect(byId(UNIT_TYPES.infantry)?.cost).toEqual({ resources: 1, unitsPerCost: 2 });
  });

  it('Gebäude werden platziert, nicht produziert', () => {
    expect(BASE_UNITS.filter(canBeProduced).map((unit) => unit.category)).not.toContain(
      'structure',
    );
  });

  it('RR 28.1: Jäger zählen nicht zum Flottenlimit', () => {
    const fighter = byId(UNIT_TYPES.fighter);
    expect(fighter && countsTowardFleetLimit(fighter)).toBe(false);
  });

  it('RR 64/62: Raumdock produziert Ressourcen +2', () => {
    const dock = byId(UNIT_TYPES.orbitalDock);
    expect(dock && findCapability(dock, 'production')).toEqual({
      kind: 'production',
      bonus: 2,
      addsPlanetResources: true,
    });
  });

  it('die Grundregeln ergeben eine gültige Standardpartie mit 6 Spielern', () => {
    expect(
      validateGameConfig({ playerCount: 6, victoryPointsToWin: 10, rules: BASE_RULE_NUMBERS }).ok,
    ).toBe(true);
  });
});
