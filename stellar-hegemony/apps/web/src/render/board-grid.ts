import type { Container, Graphics } from 'pixi.js';
import { HEX_SIZE, hexCorners, hexToPixel, type Point } from '../hex-geometry.ts';
import { type BoardView, lift, project, type Projected, SLAB, turn } from './board-view.ts';
import { type BoardFrame, type Placed, stroked } from './board-pieces.ts';
import { colorOf, mix, rgbOf } from './palette.ts';
import type { SceneHex } from './scene-model.ts';

/*
 * Linien des Bretts als Vektorgrafik: dünne Fugen zwischen den Feldern, eine helle
 * Außenkante und die Brettkante, die zum Betrachter hin sichtbar ist. Gemeinsame Kanten werden
 * nur einmal gezeichnet, damit keine Linie doppelt so hell wirkt.
 */

export interface BoardEdge {
  readonly a: Point;
  readonly b: Point;
  /** Richtung von der Feldmitte zur Kante: zeigt bei Außenkanten vom Brett weg. */
  readonly outward: Point;
  /** Liegt die Kante am Rand des Bretts (kein Nachbarfeld)? */
  readonly outer: boolean;
}

const SEAM = 0x9fb8ff;
const RIM = 0xd2dcff;
const WALL = rgbOf(0x1c2848);
/** Auf Zehntel gerundet; `String(-0)` ist „0“, so fallen gleiche Kanten zusammen. */
const keyOf = (point: Point): string =>
  `${String(Math.round(point.x * 10))},${String(Math.round(point.y * 10))}`;

/** Alle Kanten der Karte; jede gemeinsame Kante genau einmal. */
export function boardEdges(centers: readonly Point[]): readonly BoardEdge[] {
  const edges = new Map<string, { edge: BoardEdge; count: number }>();
  for (const center of centers) {
    const corners = hexCorners(center, HEX_SIZE);
    corners.forEach((a, index) => {
      const b = corners[(index + 1) % corners.length] ?? a;
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const key = keyOf(middle);
      const known = edges.get(key);
      const outward = { x: middle.x - center.x, y: middle.y - center.y };
      if (known === undefined) edges.set(key, { edge: { a, b, outward, outer: true }, count: 1 });
      else known.count += 1;
    });
  }
  return [...edges.values()].map(({ edge, count }) => ({ ...edge, outer: count === 1 }));
}

const flat = (points: readonly Projected[]): number[] => points.flatMap(({ x, y }) => [x, y]);

/** Brettkante unter einer Außenkante, wenn sie zum Betrachter zeigt; links heller als rechts. */
function wall(graphics: Graphics, edge: BoardEdge, view: BoardView, line: number) {
  const facing = turn(view, edge.outward);
  if (facing.y <= 0) return;
  const a = turn(view, edge.a);
  const b = turn(view, edge.b);
  const { tilt } = view;
  const shape = [lift(a, 0, tilt), lift(b, 0, tilt), lift(b, -SLAB, tilt), lift(a, -SLAB, tilt)];
  const light = 0.35 + 0.3 * (-facing.x / Math.hypot(facing.x, facing.y));
  graphics.poly(flat(shape)).fill(colorOf(mix([0, 0, 0], WALL, light + 0.4)));
  const [, , low, lowA] = shape;
  if (low !== undefined && lowA !== undefined)
    graphics
      .moveTo(lowA.x, lowA.y)
      .lineTo(low.x, low.y)
      .stroke({ width: 0.8 * line * low.scale, color: SEAM, alpha: 0.35 });
}

function seam(graphics: Graphics, edge: BoardEdge, view: BoardView, line: number) {
  const a = project(view, edge.a);
  const b = project(view, edge.b);
  const scale = (a.scale + b.scale) / 2;
  const [color, width, alpha] = edge.outer ? [RIM, 1.6, 0.7] : [SEAM, 0.9, 0.3];
  graphics
    .moveTo(a.x, a.y)
    .lineTo(b.x, b.y)
    .stroke({ width: width * line * scale, color, alpha });
}

/** Ganz unten bzw. ganz oben in der Grundebene, über und unter allen Kacheln. */
const BELOW = -1e6;
const ABOVE = 1e6;

/** Brettkante unter allen Kacheln, Fugen und Außenkante über ihnen (Grundebene sortiert nach `zIndex`). */
export function boardGrid(layer: Container, hexes: readonly SceneHex[]): readonly Placed[] {
  const edges = boardEdges(hexes.map((hex) => hexToPixel(hex.position)));
  const outer = edges.filter((edge) => edge.outer);
  const walls = stroked(layer, (graphics, { view, line }: BoardFrame) => {
    for (const edge of outer) wall(graphics, edge, view, line);
  });
  const seams = stroked(layer, (graphics, { view, line }: BoardFrame) => {
    for (const edge of edges) seam(graphics, edge, view, line);
  });
  walls.graphics.zIndex = BELOW;
  seams.graphics.zIndex = ABOVE;
  return [walls, seams];
}
