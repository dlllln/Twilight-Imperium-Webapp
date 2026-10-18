import { describe, expect, it } from 'vitest';
import { hexToPixel } from '../src/hex-geometry.ts';
import { project } from '../src/render/board-view.ts';
import type { SceneHex } from '../src/render/scene-model.ts';
import {
  boardPoint,
  fleetPoint,
  insideSystem,
  systemOutline,
  type FleetProjection,
} from '../src/system/fleet-placement.ts';

const hex: SceneHex = {
  key: '2,-1',
  position: { q: 2, r: -1 },
  kind: 'system',
  systemId: 'target',
  back: 'blue',
  seat: null,
  planets: [],
  ships: [{ seat: 1, type: 'carrier', count: 1 }],
  tokens: [],
  highlight: 'active',
  control: null,
  frontier: false,
  cache: 0,
  wormholes: [],
};

function projection(angle: number, tilt: number, zoom: number): FleetProjection {
  return {
    hexes: [hex],
    bounds: { minX: -500, minY: -400, width: 1000, height: 800 },
    size: { width: 1400, height: 900 },
    viewport: { panX: -90, panY: 55, zoom },
    view: { angle, tilt },
  };
}

describe('Flotten auf dem gedrehten und gezoomten Brett ablegen', () => {
  it.each([
    [0, 0, 1],
    [Math.PI / 3, 1, 2.7],
    [-Math.PI * 0.8, 1.18, 5],
  ])('trifft das richtige System bei Drehung %s, Neigung %s und Zoom %s', (angle, tilt, zoom) => {
    const frame = projection(angle, tilt, zoom);
    const center = boardPoint(frame, project(frame.view, hexToPixel(hex.position)));
    expect(insideSystem(frame, 'target', center)).toBe(true);
    const corners = systemOutline(frame, 'target');
    expect(corners).toHaveLength(6);
    for (const corner of corners) expect(insideSystem(frame, 'target', corner)).toBe(true);
    const first = corners[0];
    const second = corners[1];
    if (first === undefined || second === undefined) throw new Error('keine Ecken');
    const edge = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    expect(insideSystem(frame, 'target', edge)).toBe(true);
    const beyond = {
      x: center.x + (edge.x - center.x) * 1.05,
      y: center.y + (edge.y - center.y) * 1.05,
    };
    expect(insideSystem(frame, 'target', beyond)).toBe(false);
    expect(insideSystem(frame, 'missing', center)).toBe(false);
  });

  it('verschiebt Systemtreffer und Flottengriff gemeinsam mit dem Bildausschnitt', () => {
    const frame = projection(0.7, 1, 2);
    const moved = { ...frame, viewport: { ...frame.viewport, panX: frame.viewport.panX + 100 } };
    const before = fleetPoint(frame, 'target');
    const after = fleetPoint(moved, 'target');
    if (before === null || after === null) throw new Error('kein Griff');
    expect(after.x - before.x).toBeCloseTo(112.5);
    expect(after.y).toBeCloseTo(before.y);
    const outline = systemOutline(frame, 'target');
    const translated = systemOutline(moved, 'target');
    outline.forEach((point, index) =>
      expect((translated[index]?.x ?? 0) - point.x).toBeCloseTo(112.5),
    );
    expect(fleetPoint(frame, 'missing')).toBeNull();
    expect(systemOutline(frame, 'missing')).toEqual([]);
  });
});
