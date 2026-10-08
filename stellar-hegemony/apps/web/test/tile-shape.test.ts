import { describe, expect, it } from 'vitest';
import {
  bevelFacets,
  edgeLight,
  TILE_SHAPE,
  tileAnchor,
  tileFrame,
  tileOutline,
  tileWalls,
} from '../src/render/tile-shape.ts';

const RADIUS = 100;
const frame = tileFrame(RADIUS);

describe('Plastische Kacheln', () => {
  it('die Fläche ist kleiner als das Feld, damit Fugen bleiben; ihre Mitte liegt auf der Feldmitte', () => {
    expect(frame.face).toBeLessThan(RADIUS);
    expect(frame.width).toBeGreaterThan(2 * frame.face);
    const anchor = tileAnchor(frame);
    expect(anchor.x).toBeCloseTo(0.5, 1);
    expect(anchor.y).toBeLessThan(0.5);
  });

  it('Licht fällt von links oben: obere linke Kanten hell, untere rechte dunkel', () => {
    const top = 4;
    const lowerRight = 0;
    expect(edgeLight(top)).toBeGreaterThan(0);
    expect(edgeLight(lowerRight)).toBeLessThan(0);
    expect(bevelFacets(frame)).toHaveLength(6);
  });

  it('nur die drei unteren Kanten zeigen eine Seitenwand, um die Tiefe nach unten gezogen', () => {
    const walls = tileWalls(frame);
    expect(walls).toHaveLength(3);
    for (const wall of walls) {
      const [a, , , lowA] = wall.points;
      expect((lowA?.y ?? 0) - (a?.y ?? 0)).toBeCloseTo(RADIUS * TILE_SHAPE.depth);
      expect(a?.y ?? 0).toBeGreaterThanOrEqual(frame.center.y - 1e-9);
    }
    const lowest = Math.max(...tileOutline(frame).map((point) => point.y));
    expect(lowest).toBeLessThanOrEqual(frame.height);
  });
});
