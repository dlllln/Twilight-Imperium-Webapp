import { describe, expect, it } from 'vitest';
import { StarSystem, unitTypeId, type PlanetState, type Unit } from '../src/index.ts';
import { BLUE, catalog, planetState, RED, system, T, unit, units } from './fixtures.ts';

const inspect = (space: readonly Unit[], planets: readonly PlanetState[] = []) => {
  const result = StarSystem.inspect(system(space), planets, catalog);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe('StarSystem als Information Expert', () => {
  it('RR 28.1: Flottenlimit zählt nur Nicht-Jäger-Schiffe', () => {
    const star = inspect([...units(3, T.cruiser), ...units(5, T.fighter), unit(T.carrier)]);
    expect(star.nonFighterShipCount(RED)).toBe(4);
    expect(star.exceedsFleetLimit(RED, 3)).toBe(true);
    expect(star.exceedsFleetLimit(RED, 4)).toBe(false);
  });

  it('RR 28.1: Flottenlimit gilt pro Spieler', () => {
    const star = inspect([...units(3, T.cruiser, BLUE), unit(T.cruiser, RED)]);
    expect(star.exceedsFleetLimit(RED, 1)).toBe(false);
    expect(star.exceedsFleetLimit(BLUE, 2)).toBe(true);
  });

  it('RR 43.2: Kapazität ist die Summe aller eigenen Schiffe', () => {
    const star = inspect([unit(T.carrier), unit(T.battleship), ...units(5, T.fighter)]);
    expect(star.capacity(RED)).toBe(5);
    expect(star.capacityUsage(RED)).toBe(5);
    expect(star.exceedsCapacity(RED)).toBe(false);
  });

  it('RR 43.3: zu viele Jäger und Bodentruppen überschreiten die Kapazität', () => {
    const star = inspect([unit(T.carrier), ...units(3, T.fighter), ...units(2, T.infantry)]);
    expect(star.exceedsCapacity(RED)).toBe(true);
  });

  it('RR 43.4: Bodentruppen auf Planeten zählen nicht zur Kapazität', () => {
    const planet = planetState({ units: units(4, T.infantry) });
    expect(inspect([unit(T.cruiser)], [planet]).exceedsCapacity(RED)).toBe(false);
  });

  it('RR 64: ein Raumdock beherbergt bis zu 3 Jäger ohne Trägerkapazität', () => {
    const planet = planetState({ units: [unit(T.dock)] });
    expect(inspect(units(3, T.fighter), [planet]).exceedsCapacity(RED)).toBe(false);
    expect(inspect(units(4, T.fighter), [planet]).exceedsCapacity(RED)).toBe(true);
  });

  it('RR 64: der Hangar gilt nicht für Bodentruppen und nicht für fremde Docks', () => {
    const ownDock = planetState({ units: [unit(T.dock)] });
    const foreignDock = planetState({ units: [unit(T.dock, BLUE)] });
    expect(inspect(units(1, T.infantry), [ownDock]).exceedsCapacity(RED)).toBe(true);
    expect(inspect(units(1, T.fighter), [foreignDock]).exceedsCapacity(RED)).toBe(true);
  });

  it('kennt Schiffe, Gegner und Kommandomarker', () => {
    const star = inspect([unit(T.cruiser, RED), unit(T.fighter, BLUE), unit(T.infantry, RED)]);
    expect(star.shipsOf(RED)).toHaveLength(1);
    expect(star.hasShipsOf(BLUE)).toBe(true);
    expect(star.opponentsWithShips(RED)).toEqual([BLUE]);
    expect(star.hasCommandToken(RED)).toBe(false);
  });

  it('meldet unbekannte Einheitentypen im Weltraum und auf Planeten', () => {
    const stranger = { ...unit(T.cruiser), type: unitTypeId('nope') };
    expect(StarSystem.inspect(system([stranger]), [], catalog).ok).toBe(false);
    expect(StarSystem.inspect(system([]), [planetState({ units: [stranger] })], catalog).ok).toBe(
      false,
    );
  });
});
