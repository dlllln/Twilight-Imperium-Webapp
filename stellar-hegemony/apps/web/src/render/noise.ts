/** Deterministischer Zufall (mulberry32) für prozedurale Grafiken. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stabiler Zahlenwert aus einem Text, z. B. einer Planeten-Id. */
export function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Wert-Rauschen auf einem Gitter; liefert Werte zwischen 0 und 1. */
export class ValueNoise {
  private readonly values: Float32Array;
  private readonly size = 256;

  constructor(seed: number) {
    const random = seededRandom(seed);
    this.values = Float32Array.from({ length: this.size * this.size }, () => random());
  }

  at(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);
    const top = lerp(this.cell(x0, y0), this.cell(x0 + 1, y0), tx);
    const bottom = lerp(this.cell(x0, y0 + 1), this.cell(x0 + 1, y0 + 1), tx);
    return lerp(top, bottom, ty);
  }

  /** Fraktales Rauschen aus mehreren Oktaven. */
  fbm(x: number, y: number, octaves = 5): number {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let octave = 0; octave < octaves; octave++) {
      sum += amplitude * this.at(x * frequency, y * frequency);
      frequency *= 2;
      amplitude *= 0.5;
    }
    return sum / (1 - 0.5 ** octaves);
  }

  private cell(x: number, y: number): number {
    const wrap = (value: number) => ((value % this.size) + this.size) % this.size;
    return this.values[wrap(y) * this.size + wrap(x)] ?? 0;
  }
}
