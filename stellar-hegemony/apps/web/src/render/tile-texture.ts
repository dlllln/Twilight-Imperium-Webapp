import type { TileBack } from '@stellar/domain';
import { createCanvas } from './canvas.ts';
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

const SQRT3 = Math.sqrt(3);
const CORNERS = 6;
const FACE_ALPHA = 0.8;

const BACK_COLORS: Readonly<Record<TileBack, Rgb>> = {
  blue: rgbOf(TILE_BLUE),
  red: rgbOf(TILE_RED),
  center: rgbOf(TILE_CENTER),
  home: rgbOf(TILE_HOME),
};

function hexPath(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  context.beginPath();
  for (let corner = 0; corner < CORNERS; corner++) {
    const angle = (Math.PI / 3) * corner;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (corner === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function faceGradient(context: CanvasRenderingContext2D, base: Rgb, radius: number) {
  const gradient = context.createRadialGradient(radius, radius * 0.75, 0, radius, radius, radius);
  gradient.addColorStop(0, css(mix(base, [120, 150, 220], 0.22), FACE_ALPHA * 0.55));
  gradient.addColorStop(0.7, css(base, FACE_ALPHA * 0.75));
  gradient.addColorStop(1, css(mix(base, [0, 0, 0], 0.5), FACE_ALPHA));
  return gradient;
}

/** Halbtransparente Feldfläche: der Nebel scheint durch, der Rand wirkt wie eine Fassung. */
export function paintTileFace(back: TileBack, radius: number): HTMLCanvasElement | null {
  const width = Math.ceil(radius * 2);
  const height = Math.ceil(radius * SQRT3);
  const surface = createCanvas(width, height);
  if (surface === null) return null;
  const { context } = surface;
  hexPath(context, radius, height / 2, radius);
  context.fillStyle = faceGradient(context, BACK_COLORS[back], radius);
  context.fill();
  hexPath(context, radius, height / 2, radius * 0.9);
  context.lineWidth = radius * 0.015;
  context.strokeStyle = 'rgba(255,255,255,0.07)';
  context.stroke();
  return surface.canvas;
}
