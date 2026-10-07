import { hex, hexNeighbors, ORIGIN } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { boundsOf, HEX_SIZE, hexCorners, hexToPixel, toSvgPoints } from '../src/hex-geometry.ts';

describe('Hex-Geometrie (flache Oberkante)', () => {
  it('Nachbarn haben alle denselben Mittelpunktabstand √3 · Größe', () => {
    for (const neighbor of hexNeighbors(ORIGIN)) {
      const { x, y } = hexToPixel(neighbor);
      expect(Math.hypot(x, y)).toBeCloseTo(Math.sqrt(3) * HEX_SIZE);
    }
  });

  it('Norden liegt direkt über dem Zentrum', () => {
    expect(hexToPixel(hex(0, -1)).x).toBeCloseTo(0);
    expect(hexToPixel(hex(0, -1)).y).toBeLessThan(0);
  });

  it('ein Hex hat sechs Ecken im Abstand der Größe', () => {
    const corners = hexCorners({ x: 0, y: 0 });
    expect(corners).toHaveLength(6);
    for (const corner of corners) expect(Math.hypot(corner.x, corner.y)).toBeCloseTo(HEX_SIZE);
    expect(toSvgPoints([{ x: 1, y: 2.25 }])).toBe('1.0,2.3');
  });

  it('Grenzen umschließen alle Felder, auch ohne Felder', () => {
    const bounds = boundsOf([ORIGIN, hex(2, 0)]);
    expect(bounds.minX).toBe(-HEX_SIZE);
    expect(bounds.width).toBeCloseTo(1.5 * 2 * HEX_SIZE + 2 * HEX_SIZE);
    expect(boundsOf([])).toEqual({
      minX: -HEX_SIZE,
      minY: -HEX_SIZE,
      width: 2 * HEX_SIZE,
      height: 2 * HEX_SIZE,
    });
  });
});
