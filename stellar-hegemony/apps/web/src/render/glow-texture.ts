import { createCanvas } from './canvas.ts';

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
