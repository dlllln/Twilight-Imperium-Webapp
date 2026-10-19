import { hexToPixel } from '../hex-geometry.ts';
import { type BoardView, lift, plus, type Projected, turn } from '../render/board-view.ts';
import { PLANET_HEIGHT, planetDiameter, planetSpots } from '../render/hex-layout.ts';
import type { SceneHex, ScenePlanet } from '../render/scene-model.ts';

/*
 * Ankerpunkte auf der Karte (reine Funktionen): Wo schwebt ein Planet im Bild des Bretts, und
 * wie groß erscheint er dort? Pixi-Bild, Nahzoom-Schilder und Planetenziele teilen dieselben
 * Werte, damit Ring, Schild und Planet übereinander stehen. Alles in Brettkoordinaten.
 */

export interface PlanetAnchor {
  readonly planet: ScenePlanet;
  /** Mitte des Planeten im Bild, samt Maßstab an dieser Stelle. */
  readonly at: Projected;
  /** Halber Durchmesser im Bild (Maßstab eingerechnet). */
  readonly radius: number;
}

const ORIGIN = { x: 0, y: 0 };

/** Jeder Planet eines Felds an seinem Platz, über dem Brett schwebend; zum Betrachter gedreht. */
export function planetAnchors(hex: SceneHex, view: BoardView): readonly PlanetAnchor[] {
  const center = turn(view, hexToPixel(hex.position));
  const count = hex.planets.length;
  const spots = planetSpots(count);
  return hex.planets.map((planet, index) => {
    const at = lift(plus(center, spots[index] ?? ORIGIN), PLANET_HEIGHT, view.tilt);
    return { planet, at, radius: (planetDiameter(planet, count) / 2) * at.scale };
  });
}
