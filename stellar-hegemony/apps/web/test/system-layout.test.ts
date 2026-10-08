import { describe, expect, it } from 'vitest';
import type { SceneHex, ScenePlanet, UnitCount } from '../src/render/scene-model.ts';
import {
  fitScale,
  MAX_SHIPS_PER_TYPE,
  type PlacedPlanet,
  systemLayout,
  WORLD,
} from '../src/system/system-layout.ts';
import { blendViewport, FOCUS_ZOOM, focusViewport } from '../src/system/viewport-tween.ts';

/** Holt ein Element, das der Test sicher erwartet. */
function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`Element ${String(index)} fehlt`);
  return item;
}

const units = (seat: number, ...entries: [string, number][]): UnitCount[] =>
  entries.map(([type, count]) => ({ type, seat, count }));

function planet(id: string, value: number, planetUnits: UnitCount[] = []): ScenePlanet {
  return {
    id,
    name: id,
    definition: { id, resources: value, influence: 0 } as never,
    look: 'plain',
    controllerSeat: null,
    exhausted: false,
    units: planetUnits,
  };
}

function hex(overrides: Partial<SceneHex> = {}): SceneHex {
  return {
    key: '1,-1',
    position: { q: 1, r: -1 },
    kind: 'system',
    systemId: 'b01',
    back: 'blue',
    wormholes: [],
    seat: null,
    planets: [],
    ships: [],
    tokens: [],
    highlight: 'none',
    control: null,
    ...overrides,
  };
}

describe('Aufbau der Systemansicht', () => {
  it('Planeten stehen auf ihren Bahnen, äußere Bahnen sind weiter, wertvolle Planeten größer', () => {
    const layout = systemLayout(hex({ planets: [planet('a', 1), planet('b', 4), planet('c', 2)] }));
    const [inner, middle, outer] = [0, 1, 2].map((index) => nth(layout.planets, index)) as [
      PlacedPlanet,
      PlacedPlanet,
      PlacedPlanet,
    ];
    for (const placed of layout.planets) {
      const dx = placed.x / placed.orbit.rx;
      const dy = (placed.y - layout.star.y) / placed.orbit.ry;
      expect(dx * dx + dy * dy).toBeCloseTo(1);
      expect(placed.y).toBeGreaterThan(layout.star.y);
    }
    expect(inner.orbit.rx).toBeLessThan(middle.orbit.rx);
    expect(middle.orbit.rx).toBeLessThan(outer.orbit.rx);
    expect(middle.size).toBeGreaterThan(inner.size);
    expect(layout.central).toBe('star');
  });

  it('Bodentruppen stehen am Planeten, das Raumdock kreist als Ring um ihn', () => {
    const ground = units(2, ['infantry', 3], ['orbitalDock', 1]);
    const placed = nth(systemLayout(hex({ planets: [planet('a', 2, ground)] })).planets, 0);
    expect(placed.ground.map((piece) => piece.type)).toEqual(['infantry', 'infantry', 'infantry']);
    expect(placed.dockSeat).toBe(2);
    for (const piece of placed.ground)
      expect(Math.hypot(piece.x - placed.x, piece.y - placed.y)).toBeLessThan(placed.size);
  });

  it('Flotten stehen sich gegenüber; große Schiffe vorn, Jäger schwärmen extra', () => {
    const ships = [
      ...units(1, ['destroyer', 1], ['dreadnought', 1], ['fighter', 4]),
      ...units(3, ['cruiser', 9]),
    ];
    const fleets = systemLayout(hex({ ships })).fleets;
    const [left, right] = [nth(fleets, 0), nth(fleets, 1)];
    expect(left.ships.every((ship) => ship.facing === 1)).toBe(true);
    expect(right.ships.every((ship) => ship.facing === -1)).toBe(true);
    expect(left.x).toBeLessThan(right.x);
    expect(left.ships.map((ship) => ship.type)).toEqual(['dreadnought', 'destroyer']);
    expect(left.fighters).toBe(4);
    expect(right.ships).toHaveLength(MAX_SHIPS_PER_TYPE);
    expect(right.counts).toEqual(units(3, ['cruiser', 9]));
  });

  it('Anomalien prägen die Mitte: Supernova, Riss; leere Systeme zeigen einen fernen Stern', () => {
    expect(systemLayout(hex({ anomaly: 'supernova' })).central).toBe('supernova');
    expect(systemLayout(hex({ anomaly: 'gravityRift' })).central).toBe('rift');
    const nebula = systemLayout(hex({ anomaly: 'nebula' }));
    expect(nebula.central).toBe('distant');
    expect(nebula.backdrop).toBe('nebula');
    const holes = systemLayout(hex({ wormholes: ['alpha', 'beta'] })).wormholes;
    expect(holes.map((hole) => hole.kind)).toEqual(['alpha', 'beta']);
    expect(holes[0]?.x).not.toBe(holes[1]?.x);
  });

  it('die Bühne passt in jede Fläche, ohne verzerrt zu werden', () => {
    expect(fitScale(WORLD.width, WORLD.height)).toBe(1);
    expect(fitScale(WORLD.width / 2, WORLD.height)).toBe(0.5);
    expect(fitScale(WORLD.width, WORLD.height / 4)).toBe(0.25);
  });
});

describe('Kamerafahrt', () => {
  const bounds = { minX: -100, minY: -50, width: 200, height: 100 };

  it('rückt das System in die Mitte und vergrößert', () => {
    const view = focusViewport(bounds, { x: 30, y: -20 });
    expect(view.zoom).toBe(FOCUS_ZOOM);
    expect(view.panX + view.zoom * 30).toBeCloseTo(0);
    expect(view.panY + view.zoom * -20).toBeCloseTo(0);
  });

  it('beginnt am Start, endet am Ziel und zoomt gleichmäßig', () => {
    const from = { zoom: 1, panX: 0, panY: 0 };
    const to = { zoom: 4, panX: -80, panY: 40 };
    expect(blendViewport(from, to, 0)).toEqual(from);
    expect(blendViewport(from, to, 1)).toEqual(to);
    expect(blendViewport(from, to, 0.5).zoom).toBeCloseTo(2);
    expect(blendViewport(from, from, 0.5)).toEqual(from);
  });
});
