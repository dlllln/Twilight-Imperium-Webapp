import { type Bounds, HEX_SIZE, hexCorners, type Point } from '../hex-geometry.ts';

/*
 * Blick auf den Spieltisch (reine Funktionen): Die Karte liegt wie ein Brett auf dem Tisch und
 * wird schräg von der Seite des eigenen Heimatsystems aus gesehen, mit leichter Perspektive.
 * Kartenpunkte werden erst gedreht (`turn`, Heimat zeigt zum Betrachter), dann gekippt und
 * perspektivisch verkleinert (`lift`). Drehung und Neigung kann der Spieler frei verstellen. Pixi-Bild, SVG-Trefferflächen und Schilder nutzen dieselbe
 * Abbildung; Zoom und Verschieben der Kamera wirken danach wie bisher auf das fertige Bild.
 */

/** Wie weit das Brett vom Draufblick weggekippt ist (0 = Vogelperspektive). */
export const TILT = (50 * Math.PI) / 180;
/** Grenzen beim freien Neigen: von der Draufsicht bis zum flachen Blick über den Tisch. */
export const MIN_TILT = 0;
export const MAX_TILT = (68 * Math.PI) / 180;
/** Abstand des Auges zur Brettmitte in Karteneinheiten: je kleiner, desto stärker die Perspektive. */
const EYE = 1200;
/** Dicke der Brettkante, die zum Betrachter hin sichtbar ist. */
export const SLAB = 9;
/** Platz über der hinteren Kante für Planeten und Schiffe, die über das Brett ragen. */
const HEADROOM = 30;

/** Wie stark flach liegende Dinge beim üblichen Blick in der Höhe gestaucht erscheinen. */
export const FORESHORTEN = Math.cos(TILT);

export interface BoardView {
  /** Drehung der Karte im Bogenmaß; das eigene Heimatsystem liegt danach vorne unten. */
  readonly angle: number;
  /** Neigung des Bretts im Bogenmaß (0 = Draufsicht). */
  readonly tilt: number;
}

export const FLAT_VIEW: BoardView = { angle: 0, tilt: TILT };

/** Stauchung flach liegender Dinge bei der Neigung dieses Blicks. */
export const foreshorten = (view: BoardView): number => Math.cos(view.tilt);

/** Punkt im Bild des Bretts und Maßstab an dieser Stelle (vorne größer, hinten kleiner). */
export interface Projected {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** Dreht einen Kartenpunkt in die Sicht des Betrachters (positives y zeigt zu ihm hin). */
export function turn(view: BoardView, point: Point): Point {
  const cos = Math.cos(view.angle);
  const sin = Math.sin(view.angle);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

/**
 * Kippt einen gedrehten Punkt um `tilt`; `height` hebt ihn über das Brett (negativ: unter die
 * Oberfläche).
 */
export function lift(point: Point, height = 0, tilt = TILT): Projected {
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const depth = -point.y * sin - height * cos;
  const scale = EYE / (EYE + depth);
  return { x: point.x * scale, y: (point.y * cos - height * sin) * scale, scale };
}

export const project = (view: BoardView, point: Point, height = 0): Projected =>
  lift(turn(view, point), height, view.tilt);

export const plus = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

/** Blick aus Richtung des Heimatsystems; ohne Heimat bleibt die Karte ungedreht. */
export function viewFrom(home: Point | null, tilt = TILT): BoardView {
  if (home === null || Math.hypot(home.x, home.y) < 1) return { ...FLAT_VIEW, tilt };
  return { angle: Math.atan2(home.x, home.y), tilt };
}

/** Neigung innerhalb der erlaubten Grenzen. */
export const clampTilt = (tilt: number): number => Math.min(MAX_TILT, Math.max(MIN_TILT, tilt));

const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Zwischenstand beim Drehen des Bretts, immer über den kürzeren Weg. */
export const blendView = (from: BoardView, to: BoardView, t: number): BoardView => ({
  angle: from.angle + wrap(to.angle - from.angle) * t,
  tilt: from.tilt + (to.tilt - from.tilt) * t,
});

export const sameView = (a: BoardView, b: BoardView): boolean =>
  Math.abs(wrap(a.angle - b.angle)) < 1e-4 && Math.abs(a.tilt - b.tilt) < 1e-4;

/**
 * Bildausschnitt des Bretts aus Sicht von `view`: alle Feldecken samt Brettkante,
 * oben mit etwas Platz für Planeten und Schiffe, die über die hintere Kante ragen.
 */
export function boardBounds(view: BoardView, centers: readonly Point[]): Bounds {
  const corners = (centers.length > 0 ? centers : [{ x: 0, y: 0 }]).flatMap((center) =>
    hexCorners(center, HEX_SIZE).map((corner) => turn(view, corner)),
  );
  const points = [
    ...corners.map((point) => lift(point, 0, view.tilt)),
    ...corners.map((point) => lift(point, -SLAB, view.tilt)),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys) - HEADROOM;
  return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** Ecken eines Felds im Bild. */
export const projectedCorners = (view: BoardView, center: Point, size = HEX_SIZE): Point[] =>
  hexCorners(center, size).map((corner) => project(view, corner));
