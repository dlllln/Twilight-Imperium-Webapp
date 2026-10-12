import type { TileBack } from '@stellar/domain';
import { hexCorners, type Point } from '../hex-geometry.ts';
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

export const BACK_COLORS: Readonly<Record<TileBack, Rgb>> = {
  blue: rgbOf(TILE_BLUE),
  red: rgbOf(TILE_RED),
  center: rgbOf(TILE_CENTER),
  home: rgbOf(TILE_HOME),
};
const BLACK: Rgb = [0, 0, 0];
const STARLIGHT: Rgb = [120, 150, 220];
const SQRT3 = Math.sqrt(3);

/** Bildmaße einer Kachel: das Sechseck füllt das Bild ganz aus (Kacheln liegen fugenlos). */
export const tileImageSize = (radius: number) => ({
  width: Math.ceil(2 * radius),
  height: Math.ceil(SQRT3 * radius),
});

function hexPath(context: CanvasRenderingContext2D, center: Point, radius: number) {
  context.beginPath();
  hexCorners(center, radius).forEach(({ x, y }, index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

/** Tiefraum, oben links etwas heller, zum Rand hin dunkler: jede Kachel wirkt leicht gewölbt. */
function faceGradient(context: CanvasRenderingContext2D, center: Point, radius: number, base: Rgb) {
  const gradient = context.createRadialGradient(
    center.x - radius * 0.2,
    center.y - radius * 0.25,
    0,
    center.x,
    center.y,
    radius,
  );
  gradient.addColorStop(0, css(mix(base, STARLIGHT, 0.2)));
  gradient.addColorStop(0.7, css(base));
  gradient.addColorStop(1, css(mix(base, BLACK, 0.5)));
  return gradient;
}

/** Feiner Nebelschleier je Variante, damit nicht jede Kachel gleich aussieht. */
function paintWisps(context: CanvasRenderingContext2D, radius: number, variant: number) {
  const { width, height } = tileImageSize(radius);
  const layer = createCanvas(width, height);
  if (layer === null) return;
  const noise = new ValueNoise(variant * 7919 + 13);
  const scale = 2.6 / radius;
  paintPixels(layer.context, width, height, (x, y) => {
    const cloud = noise.fbm(x * scale, y * scale, 5);
    return [150, 172, 255, Math.round(Math.max(0, cloud - 0.5) * 110)];
  });
  context.drawImage(layer.canvas, 0, 0);
}

/**
 * Kachelfläche ohne Fassung: Linien zwischen den Feldern und die Brettkante zeichnet
 * `board-grid` als Vektorgrafik, damit sie in jeder Zoomstufe sauber und dünn bleiben.
 */
export function paintTile(
  back: TileBack,
  radius: number,
  variant: number,
): HTMLCanvasElement | null {
  const { width, height } = tileImageSize(radius);
  const surface = createCanvas(width, height);
  if (surface === null) return null;
  const { context } = surface;
  const center = { x: width / 2, y: height / 2 };
  context.save();
  hexPath(context, center, radius);
  context.clip();
  context.fillStyle = faceGradient(context, center, radius, BACK_COLORS[back]);
  context.fillRect(0, 0, width, height);
  paintWisps(context, radius, variant);
  context.restore();
  return surface.canvas;
}
