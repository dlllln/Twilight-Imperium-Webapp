import { type DomainError, domainError } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

/**
 * Axiale Hex-Koordinate (q, r) nach Red Blob Games; die dritte Würfelachse
 * ergibt sich als s = -q - r. Flache Oberkante: Nachbarn liegen direkt
 * nördlich und südlich. Wertobjekt, unveränderlich.
 */
export interface Hex {
  readonly q: number;
  readonly r: number;
}

export type HexKey = `${number},${number}`;

export enum HexDirection {
  North,
  NorthEast,
  SouthEast,
  South,
  SouthWest,
  NorthWest,
}

const DIRECTION_VECTORS: Readonly<Record<HexDirection, Hex>> = {
  [HexDirection.North]: { q: 0, r: -1 },
  [HexDirection.NorthEast]: { q: 1, r: -1 },
  [HexDirection.SouthEast]: { q: 1, r: 0 },
  [HexDirection.South]: { q: 0, r: 1 },
  [HexDirection.SouthWest]: { q: -1, r: 1 },
  [HexDirection.NorthWest]: { q: -1, r: 0 },
};

export const ALL_DIRECTIONS: readonly HexDirection[] = [
  HexDirection.North,
  HexDirection.NorthEast,
  HexDirection.SouthEast,
  HexDirection.South,
  HexDirection.SouthWest,
  HexDirection.NorthWest,
];

export const ORIGIN: Hex = { q: 0, r: 0 };

export const hex = (q: number, r: number): Hex => ({ q, r });

export const hexS = (h: Hex): number => -h.q - h.r;

export const hexEquals = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

export const hexAdd = (a: Hex, b: Hex): Hex => hex(a.q + b.q, a.r + b.r);

export const hexScale = (h: Hex, factor: number): Hex => hex(h.q * factor, h.r * factor);

export const hexDirectionVector = (direction: HexDirection): Hex => DIRECTION_VECTORS[direction];

export const hexNeighbor = (h: Hex, direction: HexDirection): Hex =>
  hexAdd(h, hexDirectionVector(direction));

export const hexNeighbors = (h: Hex): readonly Hex[] =>
  ALL_DIRECTIONS.map((direction) => hexNeighbor(h, direction));

export function hexDistance(a: Hex, b: Hex): number {
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);
  const ds = Math.abs(hexS(a) - hexS(b));
  return Math.max(dq, dr, ds);
}

export const areAdjacentHexes = (a: Hex, b: Hex): boolean => hexDistance(a, b) === 1;

/** Alle Felder mit genau `radius` Abstand, im Uhrzeigersinn ab Norden. */
export function hexRing(center: Hex, radius: number): readonly Hex[] {
  if (radius === 0) return [center];
  const ring: Hex[] = [];
  let cursor = hexAdd(center, hexScale(hexDirectionVector(HexDirection.North), radius));
  const walkOrder = [
    ...ALL_DIRECTIONS.slice(HexDirection.SouthEast),
    ...ALL_DIRECTIONS.slice(0, HexDirection.SouthEast),
  ];
  for (const direction of walkOrder) {
    for (let step = 0; step < radius; step++) {
      ring.push(cursor);
      cursor = hexNeighbor(cursor, direction);
    }
  }
  return ring;
}

/** Zentrum, dann Ring 1, Ring 2 … bis `radius` (Spiral-Reihenfolge für Map-Strings). */
export function hexSpiral(center: Hex, radius: number): readonly Hex[] {
  const rings: Hex[] = [];
  for (let current = 0; current <= radius; current++) rings.push(...hexRing(center, current));
  return rings;
}

export const hexKey = (h: Hex): HexKey => `${h.q},${h.r}`;

const HEX_KEY_PATTERN = /^(-?\d+),(-?\d+)$/;

export function parseHexKey(key: string): Result<Hex, DomainError> {
  const [, q, r] = HEX_KEY_PATTERN.exec(key) ?? [];
  if (q === undefined || r === undefined) {
    return err(domainError('hex.invalidKey', `Ungültiger Hex-Schlüssel: ${key}`));
  }
  return ok(hex(Number(q), Number(r)));
}
