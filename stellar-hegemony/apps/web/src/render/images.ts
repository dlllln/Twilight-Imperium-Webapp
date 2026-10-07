import { seatColor } from '../seat-colors.ts';
import { paintNebula } from './nebula-texture.ts';
import { hexOf, rgbOf } from './palette.ts';
import { paintUnit } from './ship-texture.ts';

/*
 * Flyweight für DOM-Ansichten: dieselben prozeduralen Bilder wie auf der Karte,
 * einmal gemalt und als Data-URL zwischengespeichert (ohne PixiJS zu laden).
 */
const cache = new Map<string, string | null>();

function cached(key: string, paint: () => HTMLCanvasElement | null): string | null {
  if (!cache.has(key)) cache.set(key, paint()?.toDataURL() ?? null);
  return cache.get(key) ?? null;
}

const MINIATURE = { width: 96, height: 48 };
const BACKDROP = { width: 640, height: 360, seed: 7 };

/** Miniatur einer Einheit in der Farbe des Platzes (1-basiert wie `seatColor`). */
export const unitImage = (type: string, seat: number): string | null =>
  cached(`unit:${type}:${String(seat)}`, () =>
    paintUnit(type, rgbOf(hexOf(seatColor(seat))), MINIATURE.width, MINIATURE.height),
  );

export const combatBackdrop = (): string | null =>
  cached('backdrop', () => paintNebula(BACKDROP.width, BACKDROP.height, BACKDROP.seed));
