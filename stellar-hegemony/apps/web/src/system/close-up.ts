import type { Bounds, Point } from '../hex-geometry.ts';
import { hexToPixel } from '../hex-geometry.ts';
import { planetDiameter, planetSpots, shipSlots } from '../render/hex-pieces.ts';
import type { SceneHex, ScenePlanet, UnitCount } from '../render/scene-model.ts';
import { type ScreenSize, worldTransform } from '../render/view-transform.ts';
import type { Viewport } from '../store.ts';
import { CLOSE_ZOOM } from './viewport-tween.ts';

/*
 * Beschriftung beim Nahzoom (reine Funktion): Wo auf dem Bildschirm stehen Planeten und
 * Flotten, die gerade zu sehen sind? Die Zahlen der Karte weichen dann lesbaren Schildern.
 */

export type CloseUpMark =
  | {
      readonly kind: 'planet';
      readonly key: string;
      readonly planet: ScenePlanet;
      readonly at: Point;
    }
  | {
      readonly kind: 'fleet';
      readonly key: string;
      readonly seat: number;
      readonly units: readonly UnitCount[];
      readonly at: Point;
    };

/** Abstand unter Planet bzw. letzter Schiffsreihe (Karteneinheiten). */
const PLANET_GAP = 3;
const FLEET_GAP = 8;
/** Schilder mehrerer Flotten im selben System stehen untereinander (Bildschirmpixel). */
const FLEET_STACK = 34;
/** Schilder knapp außerhalb des Bildes werden nicht gebaut. */
const MARGIN = 80;

type Project = (world: Point) => Point;

function planetMarks(hex: SceneHex, center: Point, project: Project): CloseUpMark[] {
  const spots = planetSpots(hex.planets.length);
  return hex.planets.map((planet, index) => {
    const spot = spots[index] ?? { x: 0, y: 0 };
    const radius = planetDiameter(planet, hex.planets.length) / 2;
    const world = { x: center.x + spot.x, y: center.y + spot.y + radius + PLANET_GAP };
    return { kind: 'planet', key: `${hex.key}:${planet.id}`, planet, at: project(world) };
  });
}

function fleetMarks(hex: SceneHex, center: Point, project: Project): CloseUpMark[] {
  const slots = shipSlots(hex.ships.length);
  const lowest = Math.max(0, ...slots.map((slot) => slot.y));
  const seats = [...new Set(hex.ships.map((unit) => unit.seat))];
  const anchor = project({ x: center.x, y: center.y + lowest + FLEET_GAP });
  return seats.map((seat, index) => ({
    kind: 'fleet',
    key: `${hex.key}:fleet:${String(seat)}`,
    seat,
    units: hex.ships.filter((unit) => unit.seat === seat),
    at: { x: anchor.x, y: anchor.y + index * FLEET_STACK },
  }));
}

const onScreen = (screen: ScreenSize) => (mark: CloseUpMark) =>
  mark.at.x > -MARGIN &&
  mark.at.y > -MARGIN &&
  mark.at.x < screen.width + MARGIN &&
  mark.at.y < screen.height + MARGIN;

/** Schilder für alles Sichtbare, sobald nah genug gezoomt ist; sonst keine. */
export function closeUpMarks(
  hexes: readonly SceneHex[],
  bounds: Bounds,
  screen: ScreenSize,
  viewport: Viewport,
): readonly CloseUpMark[] {
  if (viewport.zoom < CLOSE_ZOOM || screen.width <= 0) return [];
  const view = worldTransform(bounds, screen, viewport);
  const project: Project = ({ x, y }) => ({
    x: view.x + x * view.scale,
    y: view.y + y * view.scale,
  });
  return hexes
    .flatMap((hex) => {
      const center = hexToPixel(hex.position);
      return [...planetMarks(hex, center, project), ...fleetMarks(hex, center, project)];
    })
    .filter(onScreen(screen));
}
