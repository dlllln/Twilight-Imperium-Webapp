import type { TileBack } from '@stellar/domain';
import type { Point } from '../hex-geometry.ts';
import { createCanvas, paintPixels } from './canvas.ts';
import { ValueNoise } from './noise.ts';
import {
  css,
  mix,
  type Rgb,
  rgbOf,
  TILE_BLUE,
  TILE_CENTER,
  TILE_HOME,
  TILE_RED,
} from './palette.ts';
import { tileFace, tileFrame, type TileFrame, tileOutline } from './tile-shape.ts';

export const BACK_COLORS: Readonly<Record<TileBack, Rgb>> = {
  blue: rgbOf(TILE_BLUE),
  red: rgbOf(TILE_RED),
  center: rgbOf(TILE_CENTER),
  home: rgbOf(TILE_HOME),
};
const BLACK: Rgb = [0, 0, 0];
const STARLIGHT: Rgb = [120, 150, 220];

function polygon(context: CanvasRenderingContext2D, points: readonly Point[]) {
  context.beginPath();
  points.forEach(({ x, y }, index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

/** Weicher Schatten nach rechts unten: die Kachel liegt erhaben auf dem Tisch. */
function paintShadow(context: CanvasRenderingContext2D, frame: TileFrame) {
  context.save();
  context.shadowColor = 'rgba(0,0,0,0.9)';
  context.shadowBlur = frame.depth * 1.1;
  context.shadowOffsetX = frame.depth * 0.5;
  context.shadowOffsetY = frame.depth * 0.8;
  polygon(context, tileOutline(frame));
  context.fillStyle = 'rgb(4,6,14)';
  context.fill();
  context.restore();
}

function faceGradient(context: CanvasRenderingContext2D, frame: TileFrame, base: Rgb) {
  const { center, face } = frame;
  const gradient = context.createRadialGradient(
    center.x - face * 0.25,
    center.y - face * 0.3,
    0,
    center.x,
    center.y,
    face,
  );
  gradient.addColorStop(0, css(mix(base, STARLIGHT, 0.22)));
  gradient.addColorStop(0.65, css(base));
  gradient.addColorStop(1, css(mix(base, BLACK, 0.45)));
  return gradient;
}

/** Feiner Nebelschleier je Variante, damit nicht jede Kachel gleich aussieht. */
function paintWisps(context: CanvasRenderingContext2D, frame: TileFrame, variant: number) {
  const { width, height } = frame;
  const layer = createCanvas(width, height);
  if (layer === null) return;
  const noise = new ValueNoise(variant * 7919 + 13);
  const scale = 3 / frame.face;
  paintPixels(layer.context, width, height, (x, y) => {
    const cloud = noise.fbm(x * scale, y * scale, 4);
    return [150, 170, 255, Math.round(Math.max(0, cloud - 0.5) * 120)];
  });
  context.drawImage(layer.canvas, 0, 0);
}

/** Kachelfläche: Tiefraum mit Schleier, oben links vom Licht getroffen. */
function paintFace(
  context: CanvasRenderingContext2D,
  frame: TileFrame,
  base: Rgb,
  variant: number,
) {
  context.save();
  polygon(context, tileFace(frame));
  context.clip();
  context.fillStyle = faceGradient(context, frame, base);
  context.fillRect(0, 0, frame.width, frame.height);
  paintWisps(context, frame, variant);
  context.restore();
}

/**
 * Weicher Teil der Kachel: Schlagschatten und Fläche mit Schleier (Maße aus `tileFrame`).
 * Wände, Lichtkante und Sterne zeichnet `tileRelief` als Vektorgrafik, scharf bei jedem Zoom.
 */
export function paintTile(
  back: TileBack,
  radius: number,
  variant: number,
): HTMLCanvasElement | null {
  const frame = tileFrame(radius);
  const surface = createCanvas(frame.width, frame.height);
  if (surface === null) return null;
  const { context } = surface;
  const base = BACK_COLORS[back];
  paintShadow(context, frame);
  paintFace(context, frame, base, variant);
  return surface.canvas;
}
