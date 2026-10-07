import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALL_DIRECTIONS,
  areAdjacentHexes,
  hex,
  HexDirection,
  hexDistance,
  hexKey,
  hexNeighbor,
  hexNeighbors,
  hexRing,
  hexS,
  hexSpiral,
  ORIGIN,
  parseHexKey,
} from '../src/index.ts';

const coordinate = fc.integer({ min: -50, max: 50 });
const arbitraryHex = fc.tuple(coordinate, coordinate).map(([q, r]) => hex(q, r));

describe('Hex-Koordinaten (RR 70 Spielplan, axiale Koordinaten)', () => {
  it('die dritte Würfelachse ergibt mit q und r null', () => {
    fc.assert(fc.property(arbitraryHex, (h) => h.q + h.r + hexS(h) === 0));
  });

  it('jedes Feld hat sechs Nachbarn mit Abstand 1', () => {
    fc.assert(
      fc.property(arbitraryHex, (h) => {
        const neighbors = hexNeighbors(h);
        return neighbors.length === 6 && neighbors.every((n) => areAdjacentHexes(h, n));
      }),
    );
  });

  it('Norden liegt direkt über dem Feld (flache Oberkante)', () => {
    expect(hexNeighbor(ORIGIN, HexDirection.North)).toEqual(hex(0, -1));
    expect(hexNeighbor(ORIGIN, HexDirection.South)).toEqual(hex(0, 1));
  });

  it('Abstand ist symmetrisch und erfüllt die Dreiecksungleichung', () => {
    fc.assert(
      fc.property(arbitraryHex, arbitraryHex, arbitraryHex, (a, b, c) => {
        const symmetric = hexDistance(a, b) === hexDistance(b, a);
        return symmetric && hexDistance(a, c) <= hexDistance(a, b) + hexDistance(b, c);
      }),
    );
  });

  it('Ring r hat 6·r Felder, alle im Abstand r, ohne Duplikate', () => {
    fc.assert(
      fc.property(arbitraryHex, fc.integer({ min: 1, max: 6 }), (center, radius) => {
        const ring = hexRing(center, radius);
        const unique = new Set(ring.map(hexKey));
        return (
          ring.length === 6 * radius &&
          unique.size === ring.length &&
          ring.every((h) => hexDistance(center, h) === radius)
        );
      }),
    );
  });

  it('Ring beginnt im Norden und läuft im Uhrzeigersinn', () => {
    expect(hexRing(ORIGIN, 1)).toEqual([
      hex(0, -1),
      hex(1, -1),
      hex(1, 0),
      hex(0, 1),
      hex(-1, 1),
      hex(-1, 0),
    ]);
    expect(hexRing(ORIGIN, 0)).toEqual([ORIGIN]);
  });

  it('Spirale mit Radius 3 umfasst 37 Felder (Zentrum + 3 Ringe)', () => {
    expect(hexSpiral(ORIGIN, 3)).toHaveLength(37);
    expect(hexSpiral(ORIGIN, 3)[0]).toEqual(ORIGIN);
  });

  it('Schlüssel lassen sich verlustfrei zurücklesen', () => {
    fc.assert(
      fc.property(arbitraryHex, (h) => {
        const parsed = parseHexKey(hexKey(h));
        return parsed.ok && parsed.value.q === h.q && parsed.value.r === h.r;
      }),
    );
    expect(parseHexKey('a,b').ok).toBe(false);
  });

  it('kennt alle sechs Richtungen', () => {
    expect(ALL_DIRECTIONS).toHaveLength(6);
  });
});
