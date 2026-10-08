import type { Hex } from '@stellar/domain';

/** Abstand Mittelpunkt–Ecke eines Hexfelds in SVG-Einheiten. */
export const HEX_SIZE = 60;
const SQRT3 = Math.sqrt(3);
const CORNERS = 6;
const DEGREES_PER_CORNER = 60;
const HALF = 0.5;
const ONE_AND_HALF = 1.5;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Flache Oberkante: Nachbarn liegen direkt nördlich und südlich. */
export function hexToPixel(hex: Hex, size = HEX_SIZE): Point {
  return { x: size * ONE_AND_HALF * hex.q, y: size * SQRT3 * (hex.r + hex.q * HALF) };
}

export function hexCorners(center: Point, size = HEX_SIZE): readonly Point[] {
  return Array.from({ length: CORNERS }, (_, index) => {
    const angle = (Math.PI / 180) * DEGREES_PER_CORNER * index;
    return { x: center.x + size * Math.cos(angle), y: center.y + size * Math.sin(angle) };
  });
}

export const toSvgPoints = (points: readonly Point[]): string =>
  points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

export function boundsOf(hexes: readonly Hex[], size = HEX_SIZE): Bounds {
  if (hexes.length === 0) return { minX: -size, minY: -size, width: 2 * size, height: 2 * size };
  const centers = hexes.map((hex) => hexToPixel(hex, size));
  const xs = centers.map((point) => point.x);
  const ys = centers.map((point) => point.y);
  const minX = Math.min(...xs) - size;
  const minY = Math.min(...ys) - size;
  return {
    minX,
    minY,
    width: Math.max(...xs) + size - minX,
    height: Math.max(...ys) + size - minY,
  };
}

/** Rand um die Karte, damit Anzeigen (Spieler links, Vorräte oben, Hand unten) keine Felder verdecken. */
export interface Margins {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export const padBounds = (bounds: Bounds, margins: Margins): Bounds => ({
  minX: bounds.minX - margins.left,
  minY: bounds.minY - margins.top,
  width: bounds.width + margins.left + margins.right,
  height: bounds.height + margins.top + margins.bottom,
});
