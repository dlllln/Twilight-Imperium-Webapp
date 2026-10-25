import { ValueNoise } from './noise.ts';

/*
 * Filz und Holz des Spieltischs, prozedural aus eigenem Rauschen: Ein kleines Kachelbild je
 * Stoff wird einmal gerechnet und als CSS-Variable hinterlegt (`--felt-texture`,
 * `--wood-texture`). Die Flächen legen es als oberste Schicht über ihre Farbe; fehlt es (kein
 * Canvas, etwa in Tests), bleibt ihr bisheriges Linienmuster.
 */

/** Ein Stoff: Kachelgröße und wie hell bzw. deckend ein Bildpunkt ist (0–255). */
export interface Weave {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  /** Deckkraft eines Punkts aus dem Rauschen an der Stelle. */
  readonly alpha: (noise: ValueNoise, x: number, y: number) => number;
  /** Heller (Fasern) oder dunkler (Maserung) als die Fläche darunter. */
  readonly light: boolean;
}

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

type Field = (x: number, y: number) => number;

/**
 * Macht ein Rauschfeld kachelbar: Jeder Punkt mischt das Feld mit seinen um eine Kachel
 * verschobenen Kopien, gewichtet nach Nähe zum jeweiligen Rand; so treffen sich die Ränder.
 */
export function seamless(field: Field, width: number, height: number): Field {
  return (x, y) => {
    const u = x / width;
    const v = y / height;
    const top = field(x, y) * (1 - u) + field(x - width, y) * u;
    const bottom = field(x, y - height) * (1 - u) + field(x - width, y - height) * u;
    return top * (1 - v) + bottom * v;
  };
}

/** Ganzzahliges Durchmischen (Verschieben und Multiplizieren): benachbarte Eingaben streuen weit. */
function mix(value: number): number {
  let hash = value | 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Feines Korn je Bildpunkt: Zufall aus Lage und Saat, damit von selbst kachelbar. Jede Achse wird
 * eigens durchmischt, sonst ordnet sich das Korn zu Streifen.
 */
const grainAt = (seed: number, x: number, y: number): number =>
  mix(seed ^ mix(x + Math.imul(mix(y), 31))) / 4294967296;

/**
 * Filz: grobe Wolken und feines Korn. Beide bleiben schwach (im Mittel unter 10 %, nie über 20 %
 * deckend), damit Schrift auf der Matte lesbar bleibt.
 */
export const FELT: Weave = {
  width: 128,
  height: 128,
  seed: 0x5f3,
  light: true,
  alpha: (noise, x, y) => {
    const cloud = seamless((cx, cy) => noise.fbm(cx / 22, cy / 22, 3), 128, 128)(x, y);
    return clampByte((cloud * 0.45 + grainAt(0x5f3, x, y) * 0.55 - 0.42) * 100);
  },
};

/** Holz: lange Jahresringe quer über die Kachel, leicht gewellt; dunkle Maserung. */
export const WOOD: Weave = {
  width: 256,
  height: 64,
  seed: 0xb0a,
  light: false,
  alpha: (noise, x, y) => {
    const wave = seamless((wx, wy) => noise.fbm(wx / 64, wy / 10, 3), 256, 64)(x, y) * 5;
    const rings = Math.abs(Math.sin((y / 64) * Math.PI * 9 + wave));
    return clampByte((1 - rings) ** 3 * 70 + grainAt(0xb0a, x, y) * 12);
  },
};

/** Die Bildpunkte einer Kachel als RGBA (rein und reproduzierbar). */
export function weavePixels(weave: Weave): Uint8ClampedArray<ArrayBuffer> {
  const noise = new ValueNoise(weave.seed);
  const tone = weave.light ? 255 : 0;
  const pixels = new Uint8ClampedArray(new ArrayBuffer(weave.width * weave.height * 4));
  for (let index = 0; index < weave.width * weave.height; index += 1) {
    const x = index % weave.width;
    const y = Math.floor(index / weave.width);
    pixels.set([tone, tone, tone, weave.alpha(noise, x, y)], index * 4);
  }
  return pixels;
}

/** Zeichnet die Kachel offscreen und liefert eine Bild-URL; ohne Canvas `null`. */
async function weaveUrl(weave: Weave): Promise<string | null> {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const canvas = new OffscreenCanvas(weave.width, weave.height);
  const context = canvas.getContext('2d');
  if (context === null) return null;
  const image = new ImageData(weavePixels(weave), weave.width, weave.height);
  context.putImageData(image, 0, 0);
  return URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' }));
}

let installed: Promise<void> | null = null;

/** Hinterlegt Filz und Holz einmal je Seite als CSS-Variablen am Wurzelelement. */
export function installTableTextures(root: HTMLElement = document.documentElement): Promise<void> {
  installed ??= Promise.all([weaveUrl(FELT), weaveUrl(WOOD)])
    .then(([felt, wood]) => {
      if (felt !== null) root.style.setProperty('--felt-texture', `url(${felt})`);
      if (wood !== null) root.style.setProperty('--wood-texture', `url(${wood})`);
    })
    .catch(() => undefined);
  return installed;
}
