import { createCanvas, paintPixels } from './canvas.ts';
import { ValueNoise } from './noise.ts';
import { mix, type Rgb } from './palette.ts';

/** Sternfarben von rot bis blauweiß; die Wahl hängt am System. */
const STAR_COLORS: readonly Rgb[] = [
  [255, 196, 120],
  [255, 238, 196],
  [176, 206, 255],
  [255, 150, 110],
];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const STAR_VARIANTS = STAR_COLORS.length;

export const starColor = (hue: number): Rgb =>
  STAR_COLORS[hue % STAR_COLORS.length] ?? [255, 255, 255];

/** Glühende Scheibe mit Granulation und ausfransender Korona (eigene prozedurale Grafik). */
export function paintStar(hue: number, size: number): HTMLCanvasElement | null {
  const surface = createCanvas(size, size);
  if (surface === null) return null;
  const noise = new ValueNoise(hue + 101);
  const color = starColor(hue);
  paintPixels(surface.context, size, size, (x, y) => {
    const nx = (x / size - 0.5) * 2;
    const ny = (y / size - 0.5) * 2;
    const distance = Math.hypot(nx, ny);
    const rays = noise.fbm(Math.atan2(ny, nx) * 3 + 20, distance * 2, 4) * 0.25;
    const disc = clamp01((0.42 - distance) * 40);
    const corona = clamp01(1 - (distance - 0.38) / (0.5 + rays)) ** 2.4;
    const grain = noise.fbm(nx * 14, ny * 14, 3) * 0.25;
    const body = mix(color, [255, 255, 245], clamp01(1 - distance * 2) + grain);
    const alpha = Math.max(disc, corona * 0.85);
    return [body[0], body[1], body[2], Math.round(alpha * 255)];
  });
  return surface.canvas;
}

/** Weicher Lichtpunkt für Triebwerke, Funkeln und Leuchtspuren (wird eingefärbt). */
export function paintGlow(size: number): HTMLCanvasElement | null {
  const surface = createCanvas(size, size);
  if (surface === null) return null;
  const gradient = surface.context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  surface.context.fillStyle = gradient;
  surface.context.fillRect(0, 0, size, size);
  return surface.canvas;
}
