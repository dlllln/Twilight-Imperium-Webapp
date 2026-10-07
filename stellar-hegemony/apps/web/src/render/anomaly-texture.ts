import type { AnomalyKind } from '@stellar/domain';
import { createCanvas, paintPixels } from './canvas.ts';
import { seededRandom, ValueNoise } from './noise.ts';
import { css, mix, type Rgb } from './palette.ts';

type Pixel = readonly [number, number, number, number];
type Painter = (context: CanvasRenderingContext2D, size: number) => void;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Glühender Stern mit unruhiger Korona. */
const supernova: Painter = (context, size) => {
  const noise = new ValueNoise(11);
  paintPixels(context, size, size, (x, y): Pixel => {
    const nx = (x / size - 0.5) * 2;
    const ny = (y / size - 0.5) * 2;
    const distance = Math.hypot(nx, ny);
    const flare = noise.fbm(Math.atan2(ny, nx) * 2 + 10, distance * 4) * 0.35;
    const heat = clamp01(1 - distance / (0.55 + flare));
    const color = mix(mix([140, 20, 10], [255, 140, 30], heat), [255, 250, 220], heat * heat);
    return [color[0], color[1], color[2], Math.round(clamp01(heat * 1.6) * 255)];
  });
};

/** Farbige Gaswolke, die zum Rand hin ausfranst. */
const nebula: Painter = (context, size) => {
  const noise = new ValueNoise(23);
  paintPixels(context, size, size, (x, y): Pixel => {
    const u = x / size;
    const v = y / size;
    const edge = clamp01(1 - Math.hypot(u - 0.5, v - 0.5) * 2.1);
    const density = clamp01((noise.fbm(u * 4, v * 4) - 0.25) * 2.8) * clamp01(edge * 1.6);
    const color = mix([170, 60, 190], [70, 190, 210], noise.fbm(u * 3 + 8, v * 3));
    return [color[0], color[1], color[2], Math.round(density * 235)];
  });
};

/** Wirbel um einen schwarzen Kern mit leuchtendem Ring. */
const gravityRift: Painter = (context, size) => {
  const noise = new ValueNoise(37);
  paintPixels(context, size, size, (x, y): Pixel => {
    const nx = (x / size - 0.5) * 2;
    const ny = (y / size - 0.5) * 2;
    const distance = Math.hypot(nx, ny);
    const swirl = Math.atan2(ny, nx) + 3 / (distance + 0.25);
    const arms = noise.fbm(Math.cos(swirl) * 2 + 5, Math.sin(swirl) * 2 + 5);
    const ring = Math.exp(-(((distance - 0.32) / 0.09) ** 2));
    const light = clamp01(ring * 1.2 + arms * clamp01(1 - distance) * 0.9);
    const color = mix([60, 20, 110], [220, 170, 255], ring);
    const alpha = distance < 0.22 ? 255 : light * clamp01((1 - distance) * 3) * 255;
    return distance < 0.22 ? [0, 0, 0, 255] : [color[0], color[1], color[2], Math.round(alpha)];
  });
};

function rock(context: CanvasRenderingContext2D, random: () => number, size: number) {
  const x = size * (0.15 + random() * 0.7);
  const y = size * (0.15 + random() * 0.7);
  const radius = size * (0.015 + random() ** 3 * 0.06);
  const base: Rgb = mix([90, 80, 70], [150, 140, 125], random());
  const gradient = context.createRadialGradient(x - radius / 3, y - radius / 3, 0, x, y, radius);
  gradient.addColorStop(0, css(mix(base, [255, 255, 255], 0.35)));
  gradient.addColorStop(1, css(mix(base, [0, 0, 0], 0.6)));
  context.fillStyle = gradient;
  context.beginPath();
  const squash = 0.6 + random() * 0.4;
  context.ellipse(x, y, radius, radius * squash, random() * Math.PI, 0, Math.PI * 2);
  context.fill();
}

/** Gesteinsbrocken in einem lockeren Gürtel. */
const asteroidField: Painter = (context, size) => {
  const random = seededRandom(53);
  const count = 70;
  for (let index = 0; index < count; index++) rock(context, random, size);
};

const PAINTERS: Readonly<Record<AnomalyKind, Painter>> = {
  supernova,
  nebula,
  gravityRift,
  asteroidField,
};

/** Eigene, prozedural erzeugte Darstellung jeder Anomalie. */
export function paintAnomaly(kind: AnomalyKind, size: number): HTMLCanvasElement | null {
  const surface = createCanvas(size, size);
  if (surface === null) return null;
  PAINTERS[kind](surface.context, size);
  return surface.canvas;
}
