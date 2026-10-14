import type { Bounds, Point } from '../hex-geometry.ts';
import { hexToPixel } from '../hex-geometry.ts';
import { type BoardView, lift, plus, type Projected, turn } from '../render/board-view.ts';
import {
  PLANET_HEIGHT,
  planetDiameter,
  planetSpots,
  SHIP_HEIGHT,
  shipSlots,
} from '../render/hex-layout.ts';
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

/** Vom Bild des Bretts auf den Bildschirm. */
type ToScreen = (board: Point) => Point;

/** Unter einer stehenden Figur: `below` Karteneinheiten unter ihrem Standpunkt im Bild. */
const under = (at: Projected, below: number): Point => ({ x: at.x, y: at.y + below * at.scale });

function planetMarks(
  hex: SceneHex,
  center: Point,
  toScreen: ToScreen,
  tilt: number,
): CloseUpMark[] {
  const spots = planetSpots(hex.planets.length);
  return hex.planets.map((planet, index) => {
    const spot = spots[index] ?? { x: 0, y: 0 };
    const radius = planetDiameter(planet, hex.planets.length) / 2;
    const at = under(lift(plus(center, spot), PLANET_HEIGHT, tilt), radius + PLANET_GAP);
    return { kind: 'planet', key: `${hex.key}:${planet.id}`, planet, at: toScreen(at) };
  });
}

function fleetMarks(hex: SceneHex, center: Point, toScreen: ToScreen, tilt: number): CloseUpMark[] {
  const slots = shipSlots(hex.ships.length);
  const lowest = Math.max(0, ...slots.map((slot) => slot.y));
  const seats = [...new Set(hex.ships.map((unit) => unit.seat))];
  const front = lift(plus(center, { x: 0, y: lowest }), SHIP_HEIGHT, tilt);
  const anchor = toScreen(under(front, FLEET_GAP));
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
  view: BoardView,
): readonly CloseUpMark[] {
  if (viewport.zoom < CLOSE_ZOOM || screen.width <= 0) return [];
  const camera = worldTransform(bounds, screen, viewport);
  const toScreen: ToScreen = ({ x, y }) => ({
    x: camera.x + x * camera.scale,
    y: camera.y + y * camera.scale,
  });
  return hexes.flatMap((hex) => hexMarks(hex, view, toScreen)).filter(onScreen(screen));
}

/** Schilder eines Felds; die Anordnung im Feld zeigt immer zum Betrachter. */
function hexMarks(hex: SceneHex, view: BoardView, toScreen: ToScreen): CloseUpMark[] {
  const center = turn(view, hexToPixel(hex.position));
  return [
    ...planetMarks(hex, center, toScreen, view.tilt),
    ...fleetMarks(hex, center, toScreen, view.tilt),
  ];
}
