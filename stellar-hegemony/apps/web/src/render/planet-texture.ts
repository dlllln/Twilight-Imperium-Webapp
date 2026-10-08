import type { PlanetTrait } from '@stellar/domain';
import { createCanvas, paintPixels } from './canvas.ts';
import { hashString, ValueNoise } from './noise.ts';
import { mix, type Rgb } from './palette.ts';

export type PlanetLook = PlanetTrait | 'center' | 'plain';

/** Drei Farbstufen je Planetenart: tief, mittel, hell. */
const RAMPS: Readonly<Record<PlanetLook, readonly [Rgb, Rgb, Rgb]>> = {
  cultural: [
    [18, 52, 112],
    [52, 128, 176],
    [168, 214, 196],
  ],
  hazardous: [
    [70, 16, 10],
    [178, 70, 30],
    [244, 170, 90],
  ],
  industrial: [
    [42, 52, 34],
    [104, 120, 74],
    [190, 184, 140],
  ],
  plain: [
    [60, 54, 62],
    [128, 118, 120],
    [206, 198, 186],
  ],
  center: [
    [96, 66, 14],
    [200, 152, 54],
    [255, 230, 150],
  ],
};

const ATMOSPHERE: Readonly<Record<PlanetLook, Rgb>> = {
  cultural: [120, 190, 255],
  hazardous: [255, 140, 80],
  industrial: [170, 220, 140],
  plain: [200, 200, 220],
  center: [255, 220, 130],
};

function ramp(look: PlanetLook, t: number): Rgb {
  const [low, mid, high] = RAMPS[look];
  return t < 0.5 ? mix(low, mid, t * 2) : mix(mid, high, (t - 0.5) * 2);
}

/** Licht von links oben; z ergibt sich aus der Kugelform. */
function shade(nx: number, ny: number): number {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return Math.max(0.08, -0.55 * nx - 0.45 * ny + 0.7 * nz);
}

/** Wolkendecke und Leuchten auf der Nachtseite (Städte, Lava) je Planetenart. */
interface Features {
  readonly clouds: number;
  readonly night: Rgb | null;
  readonly shine: number;
}

const FEATURES: Readonly<Record<PlanetLook, Features>> = {
  cultural: { clouds: 0.6, night: [255, 214, 150], shine: 0.45 },
  hazardous: { clouds: 0.15, night: [255, 96, 24], shine: 0 },
  industrial: { clouds: 0.35, night: [255, 190, 110], shine: 0.15 },
  plain: { clouds: 0.4, night: null, shine: 0.1 },
  center: { clouds: 0, night: null, shine: 0.3 },
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Glanzpunkt der Sonne auf glatten Oberflächen (Meere, Gas). */
const specular = (nx: number, ny: number, nz: number): number =>
  clamp01(-0.4 * nx - 0.35 * ny + 0.85 * nz) ** 24;

function nightGlow(noise: ValueNoise, features: Features, nx: number, ny: number, light: number) {
  if (features.night === null || light > 0.3) return 0;
  const sites = noise.fbm(nx * 9 + 70, ny * 9 + 30, 3);
  return clamp01((sites - 0.58) * 6) * clamp01((0.3 - light) * 5);
}

function surfacePixel(noise: ValueNoise, look: PlanetLook, nx: number, ny: number): Rgb {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const t = noise.fbm(nx * 2.2 + nz, ny * 2.2 - nz, 6);
  const bands = look === 'center' ? Math.sin(ny * 9 + t * 4) * 0.12 : 0;
  const light = shade(nx, ny);
  const features = FEATURES[look];
  const ground = mix(ramp(look, clamp01(t + bands)), [0, 0, 0], 1 - light);
  const cloud = clamp01((noise.fbm(nx * 3.4 + 50, ny * 5 - nz, 4) - 0.55) * 3) * features.clouds;
  const cloudy = mix(ground, [235 * light, 240 * light, 250 * light], cloud);
  const lit = mix(cloudy, [255, 255, 255], specular(nx, ny, nz) * features.shine);
  return mix(lit, features.night ?? lit, nightGlow(noise, features, nx, ny, light) * (1 - cloud));
}

function atmospherePixel(
  look: PlanetLook,
  distance: number,
): readonly [number, number, number, number] {
  const [r, g, b] = ATMOSPHERE[look];
  const falloff = Math.max(0, 1 - (distance - 1) / 0.14);
  return [r, g, b, Math.round(falloff * falloff * 170)];
}

/** Prozeduraler Planet mit Oberfläche, Schattenseite und Atmosphärenrand. */
export function paintPlanet(id: string, look: PlanetLook, size: number): HTMLCanvasElement | null {
  const surface = createCanvas(size, size);
  if (surface === null) return null;
  const noise = new ValueNoise(hashString(id));
  const radius = size / 2 / 1.15;
  paintPixels(surface.context, size, size, (x, y) => {
    const nx = (x - size / 2) / radius;
    const ny = (y - size / 2) / radius;
    const distance = Math.hypot(nx, ny);
    if (distance > 1) return atmospherePixel(look, distance);
    const [r, g, b] = surfacePixel(noise, look, nx, ny);
    return [r, g, b, 255];
  });
  return surface.canvas;
}
