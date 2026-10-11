import { type Bounds, HEX_SIZE, type Point } from '../hex-geometry.ts';
import type { ScreenSize } from '../render/view-transform.ts';
import type { Viewport } from '../store.ts';

/*
 * Kamera der Sternenkarte (reine Funktionen plus eine Animationsschleife): Es gibt keine
 * eigene Systemansicht mehr, die Karte zoomt stufenlos bis an einen einzelnen Planeten heran.
 */

export const ZOOM_MIN = 0.5;
/** So nah, dass ein kleiner Planet einen großen Teil des Bildes füllt. */
export const ZOOM_MAX = 28;
/** Ab hier weichen die Zahlen auf der Karte einer lesbaren Beschriftung im DOM. */
export const CLOSE_ZOOM = 5;
/** Ersatz, solange die Bildgröße unbekannt ist (z. B. in Tests). */
export const FOCUS_ZOOM = 4;
export const CAMERA_MS = 700;
/** Anteil der Bildhöhe, den ein angesehenes System einnimmt. */
const SYSTEM_FILL = 0.62;
const SQRT3 = Math.sqrt(3);
/** Gleiten beim Mausrad: so schnell holt die Kamera ihr Ziel ein (Zeitkonstante in ms). */
const GLIDE_MS = 90;
const SETTLED_ZOOM = 0.002;
const SETTLED_PAN = 0.3;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Zoomt um `factor`, wobei der Punkt `anchor` (viewBox-Koordinaten) an seiner Stelle bleibt. */
export function zoomAround(viewport: Viewport, factor: number, anchor: Point): Viewport {
  const zoom = clamp(viewport.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  const ratio = zoom / viewport.zoom;
  return {
    zoom,
    panX: anchor.x - ratio * (anchor.x - viewport.panX),
    panY: anchor.y - ratio * (anchor.y - viewport.panY),
  };
}

/** Mitte der viewBox: dort steht, was in der Bildmitte zu sehen ist. */
export const boundsCenter = (bounds: Bounds): Point => ({
  x: bounds.minX + bounds.width / 2,
  y: bounds.minY + bounds.height / 2,
});

/** Zoom, bei dem ein Feld etwa zwei Drittel der Bildhöhe füllt. */
export function systemZoom(bounds: Bounds, screen: ScreenSize): number {
  if (screen.width <= 0 || screen.height <= 0) return FOCUS_ZOOM;
  const fit = Math.min(screen.width / bounds.width, screen.height / bounds.height);
  const span = Math.min(screen.width, screen.height) * SYSTEM_FILL;
  return clamp(span / (HEX_SIZE * SQRT3 * fit), 1, ZOOM_MAX);
}

/** Ansicht, in der `point` (Kartenkoordinaten) mittig und mit `zoom` vergrößert steht. */
export function focusViewport(bounds: Bounds, point: Point, zoom = FOCUS_ZOOM): Viewport {
  const center = boundsCenter(bounds);
  return { zoom, panX: center.x - zoom * point.x, panY: center.y - zoom * point.y };
}

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Zwischenstand zwischen zwei Ansichten bei Anteil `k`: der Zoom läuft logarithmisch, die
 * Verschiebung im selben Verhältnis, damit ein fester Punkt beim Zoomen fest bleibt.
 */
export function approach(from: Viewport, to: Viewport, k: number): Viewport {
  const zoom = from.zoom * (to.zoom / from.zoom) ** k;
  const share = from.zoom === to.zoom ? k : (zoom - from.zoom) / (to.zoom - from.zoom);
  return {
    zoom,
    panX: from.panX + (to.panX - from.panX) * share,
    panY: from.panY + (to.panY - from.panY) * share,
  };
}

/** Kamerafahrt mit sanftem Anfahren und Abbremsen; `t` von 0 bis 1. */
export const blendViewport = (from: Viewport, to: Viewport, t: number): Viewport =>
  approach(from, to, easeInOut(clamp(t, 0, 1)));

export const settled = (a: Viewport, b: Viewport): boolean =>
  Math.abs(Math.log(a.zoom / b.zoom)) < SETTLED_ZOOM &&
  Math.hypot(a.panX - b.panX, a.panY - b.panY) < SETTLED_PAN;

/** Eine laufende Kamerabewegung; eine neue ersetzt sie. */
let frame: number | null = null;
let goal: Viewport | null = null;

export function stopCamera(): void {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  goal = null;
}

/** Das Ziel einer laufenden Gleitbewegung; weitere Mausradschritte bauen darauf auf. */
export const glideGoal = (): Viewport | null => goal;

/** Fährt die Kamera in `ms` Millisekunden von `from` nach `to`. */
export function animateViewport(
  from: Viewport,
  to: Viewport,
  apply: (viewport: Viewport) => void,
  ms = CAMERA_MS,
): void {
  stopCamera();
  const start = performance.now();
  const step = (now: number) => {
    const t = (now - start) / ms;
    apply(blendViewport(from, to, t));
    frame = t < 1 ? requestAnimationFrame(step) : null;
  };
  frame = requestAnimationFrame(step);
}

/** Gleitet zum Ziel und holt es mit gleichbleibender Zeitkonstante ein (Mausrad, Zoomknöpfe). */
export function glideTo(
  to: Viewport,
  read: () => Viewport,
  apply: (viewport: Viewport) => void,
): void {
  if (goal === null) stopCamera();
  goal = to;
  if (frame !== null) return;
  let last = performance.now();
  const step = (now: number) => {
    const target = goal ?? to;
    const next = approach(read(), target, 1 - Math.exp(-(now - last) / GLIDE_MS));
    last = now;
    const done = settled(next, target);
    apply(done ? target : next);
    if (done) stopCamera();
    else frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}
