import type { SystemId } from '@stellar/domain';
import { type Bounds, hexToPixel, type Point } from '../hex-geometry.ts';
import { type BoardView, projectedCorners } from '../render/board-view.ts';
import type { SceneHex } from '../render/scene-model.ts';
import type { Viewport } from '../store.ts';
import type { Size } from './use-element-size.ts';
import { FOCUS_ZOOM, focusViewport, ZOOM_MIN } from './viewport-tween.ts';

/*
 * „Aktion ins Bild“ (reine Funktion): die Ansicht, in der alle Systeme der laufenden Aktion samt
 * Rand im Bild stehen. Die Kamera fährt nur auf Knopfdruck dorthin, nie von selbst.
 */

/** Rand um die gerahmten Systeme, in Bildschirmpixeln. */
const MARGIN_PX = 48;
/** Rand als Anteil der viewBox, solange die Bildgröße unbekannt ist (z. B. in Tests). */
const MARGIN_SHARE = 0.06;
/**
 * Mindestgröße des Rahmens in Feldern: ein System samt dem Ring seiner Nachbarn. So bleibt bei
 * einem oder zwei Systemen die Umgebung im Bild, statt dass ein Feld das ganze Bild füllt.
 */
const CONTEXT_SPAN = 3;

/** Wo gerahmt wird: der ganze Ausschnitt, sein freier Teil zwischen den Anzeigen, die Bildgröße. */
export interface FramingArea {
  readonly bounds: Bounds;
  readonly free: Bounds;
  readonly size: Size;
}

interface Box {
  readonly min: Point;
  readonly max: Point;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Umriss aller Ecken der Felder im Bild (Brettkoordinaten). */
function boxOf(corners: readonly Point[]): Box | null {
  if (corners.length === 0) return null;
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}

const widthOf = (box: Box): number => box.max.x - box.min.x;
const heightOf = (box: Box): number => box.max.y - box.min.y;
const centerOf = (box: Box): Point => ({
  x: (box.min.x + box.max.x) / 2,
  y: (box.min.y + box.max.y) / 2,
});

/** Vergrößert den Rahmen um seine Mitte auf mindestens `width` × `height`. */
function grown(box: Box, width: number, height: number): Box {
  const center = centerOf(box);
  const halfX = Math.max(widthOf(box), width) / 2;
  const halfY = Math.max(heightOf(box), height) / 2;
  return {
    min: { x: center.x - halfX, y: center.y - halfY },
    max: { x: center.x + halfX, y: center.y + halfY },
  };
}

/** Rand in viewBox-Einheiten: feste Pixel, sobald die Bildgröße bekannt ist. */
function marginOf({ bounds, size }: FramingArea): number {
  if (size.width <= 0 || size.height <= 0) return bounds.width * MARGIN_SHARE;
  const fit = Math.min(size.width / bounds.width, size.height / bounds.height);
  return MARGIN_PX / fit;
}

/** Die Felder dieser Systeme, je als Umriss ihrer Ecken, so wie sie gerade im Bild stehen. */
function fieldBoxes(view: BoardView, hexes: readonly SceneHex[], systems: readonly SystemId[]) {
  const wanted = new Set<string>(systems);
  return hexes
    .filter((hex) => hex.systemId !== null && wanted.has(hex.systemId))
    .map((hex) => boxOf(projectedCorners(view, hexToPixel(hex.position))))
    .filter((box): box is Box => box !== null);
}

/** Rahmen um alle Felder, mindestens so groß wie ein Feld samt seinen Nachbarn. */
function framedBox(fields: readonly Box[]): Box | null {
  const box = boxOf(fields.flatMap((field) => [field.min, field.max]));
  if (box === null) return null;
  const width = Math.max(...fields.map(widthOf)) * CONTEXT_SPAN;
  const height = Math.max(...fields.map(heightOf)) * CONTEXT_SPAN;
  return grown(box, width, height);
}

/**
 * Ansicht, in der die Systeme mit Rand mitten im freien Bereich zwischen den Anzeigen stehen; der
 * Zoom bleibt zwischen der ganzen Karte und dem Heranfahren an ein System. `null`, wenn keines
 * der Systeme auf der Karte liegt.
 */
export function framingViewport(
  area: FramingArea,
  view: BoardView,
  hexes: readonly SceneHex[],
  systems: readonly SystemId[],
): Viewport | null {
  const box = framedBox(fieldBoxes(view, hexes, systems));
  if (box === null) return null;
  const margin = marginOf(area);
  const { free } = area;
  const width = Math.max(widthOf(box), 1);
  const height = Math.max(heightOf(box), 1);
  const fit = Math.min((free.width - 2 * margin) / width, (free.height - 2 * margin) / height);
  return focusViewport(free, centerOf(box), clamp(fit, ZOOM_MIN, FOCUS_ZOOM));
}
