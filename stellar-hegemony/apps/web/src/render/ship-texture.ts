import { createCanvas } from './canvas.ts';
import { css, mix, type Rgb } from './palette.ts';

/*
 * Eigene Miniatur-Silhouetten, nach rechts ausgerichtet, in Normalkoordinaten (0–1).
 * Sie sollen wie lackierte Spielfiguren wirken: Spielerfarbe mit Glanzkante und Schatten.
 */
type Outline = readonly (readonly [number, number])[];

const OUTLINES: Readonly<Record<string, Outline>> = {
  fighter: [
    [0.95, 0.5],
    [0.35, 0.15],
    [0.45, 0.45],
    [0.05, 0.3],
    [0.15, 0.5],
    [0.05, 0.7],
    [0.45, 0.55],
    [0.35, 0.85],
  ],
  destroyer: [
    [1, 0.5],
    [0.55, 0.3],
    [0.1, 0.32],
    [0, 0.4],
    [0, 0.6],
    [0.1, 0.68],
    [0.55, 0.7],
  ],
  cruiser: [
    [1, 0.5],
    [0.7, 0.32],
    [0.45, 0.28],
    [0.3, 0.12],
    [0.22, 0.3],
    [0.02, 0.36],
    [0.02, 0.64],
    [0.22, 0.7],
    [0.3, 0.88],
    [0.45, 0.72],
    [0.7, 0.68],
  ],
  carrier: [
    [0.98, 0.42],
    [0.9, 0.3],
    [0.1, 0.28],
    [0.02, 0.38],
    [0.02, 0.62],
    [0.1, 0.72],
    [0.9, 0.7],
    [0.98, 0.58],
  ],
  dreadnought: [
    [1, 0.5],
    [0.85, 0.36],
    [0.6, 0.3],
    [0.55, 0.16],
    [0.35, 0.16],
    [0.3, 0.3],
    [0.05, 0.32],
    [0, 0.42],
    [0, 0.58],
    [0.05, 0.68],
    [0.3, 0.7],
    [0.35, 0.84],
    [0.55, 0.84],
    [0.6, 0.7],
    [0.85, 0.64],
  ],
  sunbreaker: [
    [1, 0.5],
    [0.8, 0.22],
    [0.62, 0.3],
    [0.5, 0.06],
    [0.2, 0.12],
    [0.02, 0.5],
    [0.2, 0.88],
    [0.5, 0.94],
    [0.62, 0.7],
    [0.8, 0.78],
  ],
  infantry: [
    [0.5, 0.05],
    [0.68, 0.18],
    [0.68, 0.36],
    [0.9, 0.5],
    [0.9, 0.95],
    [0.1, 0.95],
    [0.1, 0.5],
    [0.32, 0.36],
    [0.32, 0.18],
  ],
  orbitalBattery: [
    [0.42, 0.05],
    [0.58, 0.05],
    [0.58, 0.4],
    [0.85, 0.55],
    [0.85, 0.95],
    [0.15, 0.95],
    [0.15, 0.55],
    [0.42, 0.4],
  ],
};

/** Zusätzliche Details je Typ (Hangar, Geschütztürme, Ringe). */
const DETAILS: Readonly<
  Record<string, (c: CanvasRenderingContext2D, w: number, h: number) => void>
> = {
  carrier: (c, w, h) => c.fillRect(w * 0.35, h * 0.42, w * 0.4, h * 0.16),
  dreadnought: (c, w, h) => {
    for (const x of [0.4, 0.7]) {
      c.beginPath();
      c.arc(w * x, h * 0.5, h * 0.09, 0, Math.PI * 2);
      c.fill();
    }
  },
  sunbreaker: (c, w, h) => {
    c.beginPath();
    c.arc(w * 0.42, h * 0.5, h * 0.18, 0, Math.PI * 2);
    c.fill();
  },
};

function hullPath(
  context: CanvasRenderingContext2D,
  outline: Outline,
  width: number,
  height: number,
) {
  context.beginPath();
  outline.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x * width, y * height);
    else context.lineTo(x * width, y * height);
  });
  context.closePath();
}

function paintHull(context: CanvasRenderingContext2D, color: Rgb, height: number) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, css(mix(color, [255, 255, 255], 0.55)));
  gradient.addColorStop(0.45, css(color));
  gradient.addColorStop(1, css(mix(color, [0, 0, 0], 0.6)));
  context.fillStyle = gradient;
  context.fill();
  context.lineWidth = Math.max(1.5, height * 0.04);
  context.strokeStyle = css(mix(color, [0, 0, 0], 0.75));
  context.stroke();
}

function paintEngine(context: CanvasRenderingContext2D, width: number, height: number) {
  const glow = context.createRadialGradient(0, height / 2, 0, 0, height / 2, height * 0.35);
  glow.addColorStop(0, 'rgba(220,250,255,0.95)');
  glow.addColorStop(1, 'rgba(80,200,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width * 0.25, height);
}

function paintDock(context: CanvasRenderingContext2D, color: Rgb, size: number) {
  context.lineWidth = size * 0.12;
  context.strokeStyle = css(color);
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = size * 0.04;
  context.strokeStyle = css(mix(color, [255, 255, 255], 0.5));
  context.stroke();
  context.fillStyle = css(mix(color, [0, 0, 0], 0.3));
  context.fillRect(size * 0.44, size * 0.1, size * 0.12, size * 0.8);
}

const isGround = (type: string) => type === 'infantry' || type === 'orbitalBattery';

/** Zeichnet eine Einheit als Miniatur in der gegebenen Spielerfarbe. */
export function paintUnit(
  type: string,
  color: Rgb,
  width: number,
  height: number,
): HTMLCanvasElement | null {
  const surface = createCanvas(width, height);
  if (surface === null) return null;
  const { context } = surface;
  if (type === 'orbitalDock') {
    paintDock(context, color, Math.min(width, height));
    return surface.canvas;
  }
  if (!isGround(type)) paintEngine(context, width, height);
  hullPath(context, OUTLINES[type] ?? OUTLINES.destroyer ?? [], width, height);
  paintHull(context, color, height);
  context.fillStyle = css(mix(color, [0, 0, 0], 0.55));
  DETAILS[type]?.(context, width, height);
  return surface.canvas;
}
