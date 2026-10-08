import { hexCorners, type Point } from '../hex-geometry.ts';

/*
 * Geometrie der plastischen Kachel (reine Funktionen, ohne Canvas): Fläche, Seitenwände
 * nach unten und Lichtkanten. Licht fällt überall von links oben ein, wie bei Planeten und Schiffen.
 */

/** Maße relativ zum Feldradius. */
export const TILE_SHAPE = {
  /** Die Fläche ist etwas kleiner als das Feld, damit Fugen zwischen den Kacheln bleiben. */
  face: 0.92,
  /** Höhe der sichtbaren Seitenwand unter der Fläche. */
  depth: 0.15,
  /** Rand im Bild für den weichen Schlagschatten. */
  pad: 0.2,
  /** Breite der Lichtkante innen an der Fläche. */
  bevel: 0.08,
} as const;

export const LIGHT: Point = { x: -0.6, y: -0.8 };

const EDGES = 6;
const WALL_EDGES = [0, 1, 2] as const;
const SQRT3 = Math.sqrt(3);
const HALF_EDGE = 0.5;

/** Bildgröße (ganze Pixel) und Lage der Flächenmitte für eine Kachel mit gegebenem Feldradius. */
export interface TileFrame {
  readonly width: number;
  readonly height: number;
  readonly center: Point;
  readonly face: number;
  readonly depth: number;
}

export function tileFrame(radius: number): TileFrame {
  const face = radius * TILE_SHAPE.face;
  const pad = radius * TILE_SHAPE.pad;
  const depth = radius * TILE_SHAPE.depth;
  return {
    width: Math.ceil(2 * (face + pad)),
    height: Math.ceil(SQRT3 * face + depth + 2 * pad),
    center: { x: pad + face, y: pad + (SQRT3 * face) / 2 },
    face,
    depth,
  };
}

/** Ankerpunkt des Bildes: die Flächenmitte liegt auf der Feldmitte. */
export const tileAnchor = (frame: TileFrame): Point => ({
  x: frame.center.x / frame.width,
  y: frame.center.y / frame.height,
});

/** Wie hell eine Kante ist: 1 zeigt zum Licht, −1 davon weg (Außennormale der Kante). */
export function edgeLight(edge: number): number {
  const angle = (Math.PI / 3) * (edge + HALF_EDGE);
  return Math.cos(angle) * LIGHT.x + Math.sin(angle) * LIGHT.y;
}

const at = (points: readonly Point[], index: number): Point =>
  points[index % points.length] ?? { x: 0, y: 0 };
const lowered = (point: Point, depth: number): Point => ({ x: point.x, y: point.y + depth });

/** Ecken der Kachelfläche. */
export const tileFace = (frame: TileFrame): readonly Point[] =>
  hexCorners(frame.center, frame.face);

/** Ein Vieleck mit seiner Helligkeit, z. B. eine Seitenwand oder ein Stück Lichtkante. */
export interface LitFacet {
  readonly points: readonly Point[];
  readonly light: number;
}

/** Die drei unteren Kanten, um die Tiefe nach unten gezogen: die sichtbaren Seitenwände. */
export function tileWalls(frame: TileFrame): readonly LitFacet[] {
  const corners = tileFace(frame);
  return WALL_EDGES.map((edge) => {
    const a = at(corners, edge);
    const b = at(corners, edge + 1);
    return {
      points: [a, b, lowered(b, frame.depth), lowered(a, frame.depth)],
      light: edgeLight(edge),
    };
  });
}

/** Umriss aus Fläche und Wänden, für den Schlagschatten. */
export function tileOutline(frame: TileFrame): readonly Point[] {
  const corners = tileFace(frame);
  const top = [3, 4, 5, 0].map((index) => at(corners, index));
  const bottom = [0, 1, 2, 3].map((index) => lowered(at(corners, index), frame.depth));
  return [...top, ...bottom];
}

/** Schmale Bänder innen an jeder Kante: oben links hell, unten rechts dunkel. */
export function bevelFacets(frame: TileFrame): readonly LitFacet[] {
  const outer = tileFace(frame);
  const inner = hexCorners(frame.center, frame.face * (1 - TILE_SHAPE.bevel));
  return Array.from({ length: EDGES }, (_, edge) => ({
    points: [at(outer, edge), at(outer, edge + 1), at(inner, edge + 1), at(inner, edge)],
    light: edgeLight(edge),
  }));
}
