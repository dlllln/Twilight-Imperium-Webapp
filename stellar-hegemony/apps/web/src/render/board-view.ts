import { type Bounds, HEX_SIZE, hexCorners, type Point } from '../hex-geometry.ts';

/*
 * Blick auf den Spieltisch (reine Funktionen): Die Karte liegt wie ein Brett auf dem Tisch und
 * wird schräg von der Seite des eigenen Heimatsystems aus gesehen, mit leichter Perspektive.
 * Kartenpunkte werden erst gedreht (`turn`, Heimat zeigt zum Betrachter), dann gekippt und
 * perspektivisch verkleinert (`lift`). Pixi-Bild, SVG-Trefferflächen und Schilder nutzen dieselbe
 * Abbildung; Zoom und Verschieben der Kamera wirken danach wie bisher auf das fertige Bild.
 */

/** Wie weit das Brett vom Draufblick weggekippt ist (0 = Vogelperspektive). */
export const TILT = (50 * Math.PI) / 180;
/** Abstand des Auges zur Brettmitte in Karteneinheiten: je kleiner, desto stärker die Perspektive. */
const EYE = 1200;
/** Dicke der Brettkante, die zum Betrachter hin sichtbar ist. */
export const SLAB = 9;
/** Platz über der hinteren Kante für Planeten und Schiffe, die über das Brett ragen. */
const HEADROOM = 30;

const COS = Math.cos(TILT);
const SIN = Math.sin(TILT);
/** Wie stark flach liegende Dinge in der Höhe gestaucht erscheinen. */
export const FORESHORTEN = COS;

export interface BoardView {
  /** Drehung der Karte im Bogenmaß; das eigene Heimatsystem liegt danach vorne unten. */
  readonly angle: number;
}

export const FLAT_VIEW: BoardView = { angle: 0 };

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

/** Kippt einen gedrehten Punkt; `height` hebt ihn über das Brett (negativ: unter die Oberfläche). */
export function lift(point: Point, height = 0): Projected {
  const depth = -point.y * SIN - height * COS;
  const scale = EYE / (EYE + depth);
  return { x: point.x * scale, y: (point.y * COS - height * SIN) * scale, scale };
}

export const project = (view: BoardView, point: Point, height = 0): Projected =>
  lift(turn(view, point), height);

export const plus = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

/** Blick aus Richtung des Heimatsystems; ohne Heimat bleibt die Karte ungedreht. */
export function viewFrom(home: Point | null): BoardView {
  if (home === null || Math.hypot(home.x, home.y) < 1) return FLAT_VIEW;
  return { angle: Math.atan2(home.x, home.y) };
}

const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Zwischenstand beim Drehen des Bretts, immer über den kürzeren Weg. */
export const blendView = (from: BoardView, to: BoardView, t: number): BoardView => ({
  angle: from.angle + wrap(to.angle - from.angle) * t,
});

export const sameView = (a: BoardView, b: BoardView): boolean =>
  Math.abs(wrap(a.angle - b.angle)) < 1e-4;

/**
 * Bildausschnitt des Bretts aus Sicht von `view`: alle Feldecken samt Brettkante,
 * oben mit etwas Platz für Planeten und Schiffe, die über die hintere Kante ragen.
 */
export function boardBounds(view: BoardView, centers: readonly Point[]): Bounds {
  const corners = (centers.length > 0 ? centers : [{ x: 0, y: 0 }]).flatMap((center) =>
    hexCorners(center, HEX_SIZE).map((corner) => turn(view, corner)),
  );
  const points = [
    ...corners.map((point) => lift(point)),
    ...corners.map((point) => lift(point, -SLAB)),
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
