import type { TileBack } from '@stellar/domain';
import { GraphicsContext } from 'pixi.js';
import { HEX_SIZE, type Point } from '../hex-geometry.ts';
import { seededRandom } from './noise.ts';
import { colorOf, FRAME, mix, rgbOf } from './palette.ts';
import { BACK_COLORS } from './tile-texture.ts';
import { bevelFacets, type LitFacet, tileFrame, tileWalls } from './tile-shape.ts';

/*
 * Vektorteil der plastischen Kachel in Karteneinheiten um die Feldmitte: Seitenwände,
 * Lichtkante und Sterne, scharf in jeder Zoomstufe.
 */

const FRAME_SHAPE = tileFrame(HEX_SIZE);
const SPECKS = 46;
/** Sterne bleiben innerhalb der Lichtkante. */
const SPECK_AREA = 0.86;
const SQRT3 = Math.sqrt(3);

const centered = (point: Point): Point => ({
  x: point.x - FRAME_SHAPE.center.x,
  y: point.y - FRAME_SHAPE.center.y,
});
const flat = (points: readonly Point[]): number[] =>
  points.map(centered).flatMap(({ x, y }) => [x, y]);

function walls(context: GraphicsContext, back: TileBack): void {
  const metal = mix(BACK_COLORS[back], rgbOf(FRAME), 0.7);
  for (const wall of tileWalls(FRAME_SHAPE))
    context.poly(flat(wall.points)).fill(colorOf(mix(metal, [0, 0, 0], 0.55 - wall.light * 0.3)));
}

const facetFill = (facet: LitFacet) =>
  facet.light > 0
    ? { color: 0xffffff, alpha: facet.light * 0.32 }
    : { color: 0x000000, alpha: -facet.light * 0.45 };

function bevel(context: GraphicsContext): void {
  for (const facet of bevelFacets(FRAME_SHAPE))
    context.poly(flat(facet.points)).fill(facetFill(facet));
}

/** Liegt der Punkt in einem Sechseck mit flacher Oberkante und Radius `radius`? */
export function insideHex({ x, y }: Point, radius: number): boolean {
  const qx = Math.abs(x);
  const qy = Math.abs(y);
  return qy <= (SQRT3 / 2) * radius && SQRT3 * qx + qy <= SQRT3 * radius;
}

function specks(context: GraphicsContext, variant: number, line: number): void {
  const random = seededRandom(variant * 104729 + 1);
  const radius = FRAME_SHAPE.face * SPECK_AREA;
  for (let speck = 0; speck < SPECKS; speck++) {
    const at = { x: (random() - 0.5) * 2 * radius, y: (random() - 0.5) * SQRT3 * radius };
    const size = radius * (0.004 + random() * 0.008) * line;
    const alpha = 0.15 + random() * 0.5;
    if (insideHex(at, radius)) context.circle(at.x, at.y, size).fill({ color: 0xe6f0ff, alpha });
  }
}

const contexts = new Map<string, GraphicsContext>();

function shared(key: string, draw: (context: GraphicsContext) => void): GraphicsContext {
  const known = contexts.get(key);
  if (known !== undefined) return known;
  const context = new GraphicsContext();
  draw(context);
  contexts.set(key, context);
  return context;
}

/** Wände und Lichtkante, geteilt je Rückseite (Flyweight); sie wachsen mit der Kachel. */
export const tileRelief = (back: TileBack): GraphicsContext =>
  shared(`relief:${back}`, (context) => {
    walls(context, back);
    bevel(context);
  });

/** Sterne auf der Kachel; sie bleiben beim Nahzoom klein wie echte Sterne (`line`). */
export const tileSpecks = (variant: number, line: number): GraphicsContext =>
  shared(`specks:${String(variant)}:${line.toFixed(3)}`, (context) =>
    specks(context, variant, line),
  );
