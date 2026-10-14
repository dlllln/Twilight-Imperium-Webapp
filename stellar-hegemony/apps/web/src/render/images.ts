import { seatColor } from '../seat-colors.ts';
import { unitArtwork } from '../artwork/units.ts';
import { paintNebula } from './nebula-texture.ts';
import { type PlanetLook, paintPlanet } from './planet-texture.ts';
import { hexOf, rgbOf } from './palette.ts';
import { paintUnit } from './ship-texture.ts';

/*
 * Originale TI4-Miniaturen für DOM-Ansichten; prozedurale Bilder bleiben als Fallback
 * einmal gemalt und als Data-URL zwischengespeichert (ohne PixiJS zu laden).
 */
const cache = new Map<string, string | null>();

function cached(key: string, paint: () => HTMLCanvasElement | null): string | null {
  if (!cache.has(key)) cache.set(key, paint()?.toDataURL() ?? null);
  return cache.get(key) ?? null;
}

const MINIATURE = { width: 96, height: 48 };
const BACKDROP = { width: 640, height: 360, seed: 7 };
const PORTRAIT = 320;
const CARD_SHIP = { width: 240, height: 120 };

/** Miniatur einer Einheit in der Farbe des Platzes (1-basiert wie `seatColor`). */
export const unitImage = (type: string, seat: number): string | null =>
  unitArtwork(type, seat) ?? fallbackUnitImage(type, seat);

export const fallbackUnitImage = (type: string, seat: number): string | null =>
  cached(`unit:${type}:${String(seat)}`, () =>
    paintUnit(type, rgbOf(hexOf(seatColor(seat))), MINIATURE.width, MINIATURE.height),
  );

export const combatBackdrop = (): string | null =>
  cached('backdrop', () => paintNebula(BACKDROP.width, BACKDROP.height, BACKDROP.seed));

/** Große Schiffsdarstellung für die Baukarten des Simulators. */
export const shipImage = (type: string, seat: number): string | null =>
  unitArtwork(type, seat) ?? fallbackShipImage(type, seat);

export const fallbackShipImage = (type: string, seat: number): string | null =>
  cached(`ship:${type}:${String(seat)}`, () =>
    paintUnit(type, rgbOf(hexOf(seatColor(seat))), CARD_SHIP.width, CARD_SHIP.height),
  );

/** One fallback attempt, including in offline/partial asset installations. */
export function replaceBrokenUnitImage(image: HTMLImageElement, fallback: string | null): void {
  if (fallback === null || image.src === fallback) return;
  image.src = fallback;
}

/** Planet als Bild, etwa die Heimatwelt einer Fraktion in der Fraktionswahl. */
export const planetImage = (id: string, look: PlanetLook): string | null =>
  cached(`planet:${id}`, () => paintPlanet(id, look, PORTRAIT));
