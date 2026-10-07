import { createCanvas, paintPixels } from './canvas.ts';
import { seededRandom, ValueNoise } from './noise.ts';
import { mix, type Rgb } from './palette.ts';

const DEEP: Rgb = [4, 6, 18];
const BLUE: Rgb = [22, 52, 120];
const TEAL: Rgb = [30, 110, 150];
const VIOLET: Rgb = [92, 34, 120];

/** Farbe eines Nebelpunkts aus zwei Rauschfeldern (blaue Wolken, violette Schleier). */
export function nebulaColor(noise: ValueNoise, u: number, v: number): Rgb {
  const clouds = noise.fbm(u * 3, v * 3);
  const veil = noise.fbm(u * 5 + 17, v * 5 + 9);
  const glow = noise.fbm(u * 2 + 40, v * 2 + 3);
  const base = mix(DEEP, BLUE, Math.max(0, clouds - 0.35) * 1.6);
  const tinted = mix(base, TEAL, Math.max(0, glow - 0.6) * 1.5);
  return mix(tinted, VIOLET, Math.max(0, veil - 0.55) * 1.4);
}

function sprinkleStars(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
) {
  const random = seededRandom(seed);
  const count = Math.round((width * height) / 900);
  for (let star = 0; star < count; star++) {
    const size = random() < 0.92 ? random() * 0.9 + 0.3 : random() * 1.6 + 1;
    context.fillStyle = `rgba(255,${String(225 + Math.round(random() * 30))},255,${String(0.35 + random() * 0.65)})`;
    context.beginPath();
    context.arc(random() * width, random() * height, size, 0, Math.PI * 2);
    context.fill();
  }
}

/** Prozeduraler Sternennebel als Hintergrundbild (eigene Grafik, kein Fremdmaterial). */
export function paintNebula(width: number, height: number, seed: number): HTMLCanvasElement | null {
  const surface = createCanvas(width, height);
  if (surface === null) return null;
  const noise = new ValueNoise(seed);
  paintPixels(surface.context, width, height, (x, y) => {
    const [r, g, b] = nebulaColor(noise, x / width, y / height);
    return [r, g, b, 255];
  });
  sprinkleStars(surface.context, width, height, seed + 1);
  return surface.canvas;
}
