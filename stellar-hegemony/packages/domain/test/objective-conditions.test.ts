import { describe, expect, it } from 'vitest';
import {
  type GameState,
  meetsCondition,
  type ObjectiveCondition,
  planetId,
  type PlayerId,
  type SystemState,
  technologyId,
  updatePlayer,
} from '../src/index.ts';
import type { units } from './fixtures.ts';
import { BLUE, content, RED, T, unit } from './fixtures.ts';
import { actionPhaseGame } from './game-flow.ts';

const ALPHA = planetId('alpha-1');
const GAMMA = planetId('gamma-1');
const DELTA = planetId('delta-1');
const BLUE_PRIME = planetId('blue-prime');

const meets = (state: GameState, condition: ObjectiveCondition, player: PlayerId = RED) =>
  meetsCondition({ state, player, content }, condition);

const control = (state: GameState, planets: readonly string[], player: PlayerId = RED) => ({
  ...state,
  planets: Object.fromEntries(
    Object.entries(state.planets).map(([id, planet]) => [
      id,
      planets.includes(id) ? { ...planet, controller: player } : planet,
    ]),
  ),
});

const systemWithTile = (state: GameState, tile: string): SystemState => {
  const system = state.systems[tile];
  if (system === undefined) throw new Error(`System ${tile} fehlt`);
  return system;
};

const withShips = (state: GameState, tile: string, ships: ReturnType<typeof units>) => ({
  ...state,
  systems: {
    ...state.systems,
    [tile]: { ...systemWithTile(state, tile), spaceUnits: ships },
  },
});

const owning = (state: GameState, technologies: readonly string[]) =>
  updatePlayer(state, RED, (p) => ({ ...p, technologies: technologies.map(technologyId) }));

describe('Anforderungen der Aufträge (RR 12.4)', () => {
  const base = actionPhaseGame();

  it('Planeten: Anzahl, außerhalb der Heimat, je Eigenschaft und mit Spezialisierung', () => {
    const state = control(base, [ALPHA, GAMMA]);
    expect(meets(state, { kind: 'planets', count: 3 })).toBe(true);
    expect(meets(state, { kind: 'planets', count: 3, exceptHome: true })).toBe(false);
    expect(meets(state, { kind: 'planets', count: 1, trait: 'cultural' })).toBe(false);
    expect(meets(state, { kind: 'planetsOfEachTrait', count: 1 })).toBe(false);
    expect(meets(state, { kind: 'specialtyPlanets', count: 1 })).toBe(true);
    expect(meets(state, { kind: 'specialtyPlanets', count: 2, distinct: true })).toBe(false);
  });

  it('Handelswaren, Flottenpool, Kommandomarker und Ausgaben', () => {
    const rich = updatePlayer(base, RED, (p) => ({ ...p, tradeGoods: 4 }));
    expect(meets(rich, { kind: 'tradeGoods', count: 4 })).toBe(true);
    expect(meets(base, { kind: 'tradeGoods', count: 4 })).toBe(false);
    expect(meets(base, { kind: 'fleetPool', count: 3 })).toBe(true);
    expect(meets(base, { kind: 'fleetPool', count: 4 })).toBe(false);
    expect(meets(base, { kind: 'systemsWithTokens', count: 1 })).toBe(false);
    const marked = {
      ...base,
      systems: { ...base.systems, b1: { ...systemWithTile(base, 'b1'), commandTokens: [RED] } },
    };
    expect(meets(marked, { kind: 'systemsWithTokens', count: 1 })).toBe(true);
    expect(meets(base, { kind: 'spend', currency: 'influence', amount: 99 })).toBe(true);
  });

  it('Technologien: Farben, eine Farbe und Aufwertungen', () => {
    const state = owning(base, ['drive-a', 'drive-b', 'gunnery', 'breaker-plans', 'heavy-carrier']);
    expect(meets(state, { kind: 'technologiesInColors', colors: 2, perColor: 2 })).toBe(true);
    expect(meets(state, { kind: 'technologiesInColors', colors: 3, perColor: 1 })).toBe(false);
    expect(meets(state, { kind: 'technologiesOfColor', count: 2 })).toBe(true);
    expect(meets(state, { kind: 'technologiesOfColor', color: 'biotic', count: 1 })).toBe(false);
    expect(meets(state, { kind: 'technologiesOfColor', color: 'warfare', count: 2 })).toBe(true);
    expect(meets(state, { kind: 'unitUpgrades', count: 1 })).toBe(true);
    expect(meets(base, { kind: 'unitUpgrades', count: 1 })).toBe(false);
  });

  it('Einheiten und Gebäude', () => {
    expect(meets(base, { kind: 'structuredPlanets', count: 1 })).toBe(true);
    expect(meets(base, { kind: 'structuredPlanets', count: 2 })).toBe(false);
    expect(meets(base, { kind: 'structures', capability: 'production', count: 1 })).toBe(true);
    expect(meets(base, { kind: 'structures', capability: 'spaceCannon', count: 1 })).toBe(false);
    expect(meets(base, { kind: 'units', type: T.fighter, count: 2 })).toBe(true);
    expect(meets(base, { kind: 'units', type: T.fighter, count: 3 })).toBe(false);
    expect(meets(base, { kind: 'shipsInOneSystem', count: 3 })).toBe(true);
    expect(meets(base, { kind: 'shipsInOneSystem', count: 4 })).toBe(false);
  });

  it('Schiffe in bestimmten Systemen: Anomalie, neben dem Zentrum, im Zentrum, fremde Heimat', () => {
    const where = (tile: string) => withShips(base, tile, [unit(T.cruiser), unit(T.fighter, BLUE)]);
    const at = (tile: string, filter: Parameters<typeof meets>[1]) => meets(where(tile), filter);
    expect(at('r1', { kind: 'systemsWithShips', where: 'anomaly', count: 1 })).toBe(true);
    expect(at('b1', { kind: 'systemsWithShips', where: 'anomaly', count: 1 })).toBe(false);
    expect(at('b1', { kind: 'systemsWithShips', where: 'adjacentToCenter', count: 1 })).toBe(true);
    expect(at('center', { kind: 'systemsWithShips', where: 'center', count: 1 })).toBe(true);
    expect(at('home-blue', { kind: 'systemsWithShips', where: 'foreignHome', count: 1 })).toBe(
      true,
    );
    expect(meets(base, { kind: 'systemsWithShips', where: 'anyNonHome', count: 1 })).toBe(false);
    expect(at('b1', { kind: 'systemsWithShips', where: 'anyNonHome', count: 1 })).toBe(true);
  });

  it('Thronwelt und Planeten in fremden Heimatsystemen', () => {
    expect(meets(base, { kind: 'centerPlanet' })).toBe(false);
    expect(meets(control(base, [planetId('throne')]), { kind: 'centerPlanet' })).toBe(true);
    expect(meets(base, { kind: 'foreignHomePlanet' })).toBe(false);
    expect(meets(control(base, [BLUE_PRIME]), { kind: 'foreignHomePlanet' })).toBe(true);
    expect(meets(control(base, [DELTA]), { kind: 'foreignHomePlanet' })).toBe(false);
  });

  it('Rundenzähler und unbekannte Spieler', () => {
    expect(meets(base, { kind: 'roundStat', stat: 'planetsGained', count: 1 })).toBe(false);
    const ghost = 'ghost' as PlayerId;
    expect(meets(base, { kind: 'roundStat', stat: 'planetsGained', count: 0 }, ghost)).toBe(true);
    expect(meets(base, { kind: 'fleetPool', count: 1 }, ghost)).toBe(false);
    expect(meets(base, { kind: 'tradeGoods', count: 1 }, ghost)).toBe(false);
    expect(meets(base, { kind: 'planets', count: 1, exceptHome: true }, ghost)).toBe(false);
  });
});
