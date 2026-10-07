import type { Bounds } from '../hex-geometry.ts';
import type { Viewport } from '../store.ts';

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

export interface WorldTransform {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Dieselbe Abbildung wie eine SVG-viewBox mit „xMidYMid meet“ plus
 * `translate(pan) scale(zoom)`. So liegen Pixi-Bild und SVG-Trefferflächen deckungsgleich.
 */
export function worldTransform(
  bounds: Bounds,
  screen: ScreenSize,
  viewport: Viewport,
): WorldTransform {
  const fit = Math.min(screen.width / bounds.width, screen.height / bounds.height);
  const offsetX = (screen.width - bounds.width * fit) / 2;
  const offsetY = (screen.height - bounds.height * fit) / 2;
  return {
    scale: fit * viewport.zoom,
    x: offsetX + fit * (viewport.panX - bounds.minX),
    y: offsetY + fit * (viewport.panY - bounds.minY),
  };
}
