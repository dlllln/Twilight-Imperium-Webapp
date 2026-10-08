import type { Bounds } from '../hex-geometry.ts';
import type { Viewport } from '../store.ts';

/** So nah fährt die Kamera an ein System heran, bevor die Systemansicht aufgeht. */
export const FOCUS_ZOOM = 3.4;
export const CAMERA_MS = 650;

/** Ansicht, in der `point` (Kartenkoordinaten) mittig und vergrößert steht. */
export function focusViewport(bounds: Bounds, point: { x: number; y: number }): Viewport {
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;
  return {
    zoom: FOCUS_ZOOM,
    panX: centerX - FOCUS_ZOOM * point.x,
    panY: centerY - FOCUS_ZOOM * point.y,
  };
}

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** Zwischenstand der Kamerafahrt; der Zoom läuft logarithmisch, damit er gleichmäßig wirkt. */
export function blendViewport(from: Viewport, to: Viewport, t: number): Viewport {
  const k = easeInOut(Math.min(1, Math.max(0, t)));
  const zoom = from.zoom * (to.zoom / from.zoom) ** k;
  const share = from.zoom === to.zoom ? k : (zoom - from.zoom) / (to.zoom - from.zoom);
  return {
    zoom,
    panX: from.panX + (to.panX - from.panX) * share,
    panY: from.panY + (to.panY - from.panY) * share,
  };
}

let running: number | null = null;

/** Fährt die Kamera in `ms` Millisekunden von `from` nach `to`; ein neuer Aufruf bricht ab. */
export function animateViewport(
  from: Viewport,
  to: Viewport,
  apply: (viewport: Viewport) => void,
  ms = CAMERA_MS,
): void {
  if (running !== null) cancelAnimationFrame(running);
  const start = performance.now();
  const step = (now: number) => {
    const t = (now - start) / ms;
    apply(blendViewport(from, to, t));
    running = t < 1 ? requestAnimationFrame(step) : null;
  };
  running = requestAnimationFrame(step);
}

/** Ab diesem Zoom öffnet weiteres Hineinzoomen das System in der Bildmitte von selbst. */
export const AUTO_OPEN_ZOOM = 2.9;

/** Ob ein Zoomschritt von `zoom` um `factor` die Schwelle zur Systemansicht erreicht. */
export const reachesSystem = (zoom: number, factor: number): boolean =>
  factor > 1 && zoom * factor >= AUTO_OPEN_ZOOM;

/** Der Kartenpunkt, der gerade mittig im Bild steht. */
export function viewCenter(bounds: Bounds, viewport: Viewport): { x: number; y: number } {
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;
  return {
    x: (centerX - viewport.panX) / viewport.zoom,
    y: (centerY - viewport.panY) / viewport.zoom,
  };
}
