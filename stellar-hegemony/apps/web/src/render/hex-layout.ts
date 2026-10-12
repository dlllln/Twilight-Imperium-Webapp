import { planetStyle } from './planet-style.ts';
import type { ScenePlanet } from './scene-model.ts';

/*
 * Anordnung im Feld (reine Funktionen, ohne Pixi): Plätze und Größen von Planeten, Flotten und
 * Markern relativ zur Feldmitte, in Blickrichtung des Betrachters (positives y zeigt zu ihm).
 * Karte und Nahbeschriftung nutzen dieselben Werte.
 */

export interface Spot {
  readonly x: number;
  readonly y: number;
}

/** Planetenplätze je nach Anzahl; vorne bleibt Platz für Flotten. */
const PLANET_SPOTS: readonly (readonly Spot[])[] = [
  [],
  [{ x: 0, y: -6 }],
  [
    { x: -18, y: -12 },
    { x: 17, y: 4 },
  ],
  [
    { x: -21, y: -15 },
    { x: 19, y: -17 },
    { x: 0, y: 12 },
  ],
];
const PLANET_DIAMETERS = [0, 34, 27, 22];
const CENTER_DIAMETER = 42;
const SHIP_ROW_Y = 33;
const SHIP_SPACING = 24;
const SHIPS_PER_ROW = 3;
const SHIP_ROW_GAP = 13;

/** Planeten schweben über dem Brett, Schiffe etwas tiefer (Karteneinheiten). */
export const PLANET_HEIGHT = 8;
export const SHIP_HEIGHT = 5;
/** Kommandomarker liegen hinten im Feld. */
export const TOKEN_Y = -40;

export const planetSpots = (count: number): readonly Spot[] =>
  PLANET_SPOTS[count] ?? PLANET_SPOTS[PLANET_SPOTS.length - 1] ?? [];

/** Grundgröße je Anzahl im Feld, dazu große und kleine Welten je nach Planet. */
export function planetDiameter(planet: ScenePlanet, count: number): number {
  if (planet.look === 'center') return CENTER_DIAMETER;
  const base = PLANET_DIAMETERS[count] ?? CENTER_DIAMETER / 2;
  return base * planetStyle(planet.id, planet.look).size;
}

/** Plätze der Schiffsgruppen: Reihen zu drei vorne im Feld. */
export function shipSlots(count: number): readonly Spot[] {
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / SHIPS_PER_ROW);
    const inRow = Math.min(SHIPS_PER_ROW, count - row * SHIPS_PER_ROW);
    const column = index % SHIPS_PER_ROW;
    return { x: (column - (inRow - 1) / 2) * SHIP_SPACING, y: SHIP_ROW_Y + row * SHIP_ROW_GAP };
  });
}
