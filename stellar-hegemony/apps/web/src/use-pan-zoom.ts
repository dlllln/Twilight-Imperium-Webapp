import { type PointerEvent, type RefObject, useRef, useState, type WheelEvent } from 'react';
import { useGalaxyStore } from './store.ts';
import { useOrbitStore } from './system/orbit-store.ts';
import { stopCamera } from './system/viewport-tween.ts';

/** Zoom je Pixel Mausradweg: eine Raste (100 px) vergrößert um gut ein Viertel. */
const WHEEL_SENSITIVITY = 0.0022;
/** Zeilen- bzw. Seitenschritte mancher Browser in Pixel umrechnen. */
const LINE_PIXELS = 33;
const PAGE_PIXELS = 400;
const MAX_WHEEL_STEP = 2;
/** Ab so vielen Pixeln gilt ein Klick als Ziehen und wählt kein Feld. */
const DRAG_THRESHOLD = 5;
/** Drehen und Neigen mit rechter Maustaste (oder Umschalt): Bogenmaß je Pixel. */
const TURN_PER_PIXEL = 0.006;
const TILT_PER_PIXEL = 0.004;
const SECONDARY_BUTTON = 2;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PanZoomHandlers {
  readonly cursor: Point;
  /** Ob der letzte Zeiger ein Finger war; dann stört ein Hinweis am Zeiger nur. */
  readonly touch: boolean;
  /** Ob die letzte Zeigerbewegung ein Verschieben oder Zoomen der Karte war. */
  readonly wasDrag: () => boolean;
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onWheel: (event: WheelEvent<HTMLElement>) => void;
  /** Die rechte Maustaste dreht die Karte; ein Kontextmenü stört dabei. */
  readonly onContextMenu: (event: { preventDefault: () => void }) => void;
}

/** Ziehen hält eine laufende Kamerafahrt an, sonst würde sie die Verschiebung überschreiben. */
function useDragPan(scale: () => number) {
  const panBy = useGalaxyStore((state) => state.panBy);
  return (dx: number, dy: number) => {
    stopCamera();
    panBy(dx * scale(), dy * scale());
  };
}

const pointOf = (event: { readonly clientX: number; readonly clientY: number }): Point => ({
  x: event.clientX,
  y: event.clientY,
});

/** Stufenloser Faktor; Trackpads liefern viele kleine Schritte, Mausräder wenige große. */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  const pixels = deltaY * ([1, LINE_PIXELS, PAGE_PIXELS][deltaMode] ?? 1);
  const factor = Math.exp(-pixels * WHEEL_SENSITIVITY);
  return Math.min(MAX_WHEEL_STEP, Math.max(1 / MAX_WHEEL_STEP, factor));
}

type Pair = readonly [Point, Point];

const middle = ([a, b]: Pair): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const span = ([a, b]: Pair): number => Math.hypot(a.x - b.x, a.y - b.y);
const direction = ([a, b]: Pair): number => Math.atan2(b.y - a.y, b.x - a.x);
const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

/**
 * Zwei Finger (reine Funktion): Der Abstand ändert den Zoom um den Mittelpunkt, ein Wandern
 * des Mittelpunkts verschiebt die Karte, ein Verdrehen dreht sie – wie bei Karten-Apps.
 */
export function pinchStep(before: Pair, after: Pair) {
  const from = middle(before);
  const to = middle(after);
  return {
    factor: span(after) / Math.max(1, span(before)),
    center: to,
    dx: to.x - from.x,
    dy: to.y - from.y,
    twist: wrap(direction(after) - direction(before)),
  };
}

interface Gestures {
  readonly pan: (dx: number, dy: number) => void;
  readonly zoomAt: (factor: number, client: Point) => void;
  /** Dreht (Bogenmaß) und neigt die Karte. */
  readonly orbit: (turn: number, tilt: number) => void;
}

type PointerHandlers = Pick<
  PanZoomHandlers,
  'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'wasDrag'
> & {
  readonly moveTo: (event: PointerEvent<HTMLElement>) => void;
};

function firstTwo(points: ReadonlyMap<number, Point>): Pair | null {
  const [a, b] = points.values();
  return a === undefined || b === undefined ? null : [a, b];
}

function pinch(gestures: Gestures, before: Pair, after: Pair): void {
  const step = pinchStep(before, after);
  gestures.zoomAt(step.factor, step.center);
  gestures.pan(step.dx, step.dy);
  gestures.orbit(step.twist, 0);
}

/** Finger (oder Maus) auf der Karte und wie weit sie seit dem Aufsetzen gewandert sind. */
interface Touches {
  readonly points: Map<number, Point>;
  travelled: number;
  /** Rechte Maustaste oder Umschalt: Ziehen dreht und neigt statt zu verschieben. */
  orbiting: boolean;
}

/** Ein Zeiger zieht: verschieben oder, im Drehmodus, drehen und neigen. */
function drag(touches: Touches, gestures: Gestures, dx: number, dy: number): void {
  if (touches.orbiting) gestures.orbit(-dx * TURN_PER_PIXEL, -dy * TILT_PER_PIXEL);
  else gestures.pan(dx, dy);
}

/** Ein Finger oder die Maus verschiebt, zwei Finger zoomen; gemeldet in Bildschirm-Pixeln. */
function moveFinger(touches: Touches, gestures: Gestures, event: PointerEvent<HTMLElement>) {
  const before = touches.points.get(event.pointerId);
  if (before === undefined) return;
  // Außerhalb losgelassene Maustaste: kein Ziehen mehr.
  if (event.pointerType === 'mouse' && event.buttons === 0) {
    touches.points.delete(event.pointerId);
    return;
  }
  const pair = firstTwo(touches.points);
  touches.points.set(event.pointerId, pointOf(event));
  const dx = event.clientX - before.x;
  const dy = event.clientY - before.y;
  touches.travelled += Math.hypot(dx, dy);
  const after = firstTwo(touches.points);
  if (pair === null || after === null) drag(touches, gestures, dx, dy);
  else pinch(gestures, pair, after);
}

function usePointers(gestures: Gestures): PointerHandlers {
  const touches = useRef<Touches>({ points: new Map(), travelled: 0, orbiting: false }).current;
  const release = (event: PointerEvent<HTMLElement>) => touches.points.delete(event.pointerId);
  return {
    onPointerDown: (event) => {
      if (touches.points.size === 0) touches.travelled = 0;
      touches.orbiting = event.button === SECONDARY_BUTTON || event.shiftKey;
      touches.points.set(event.pointerId, pointOf(event));
    },
    onPointerUp: release,
    onPointerCancel: release,
    wasDrag: () => touches.travelled > DRAG_THRESHOLD,
    moveTo: (event) => moveFinger(touches, gestures, event),
  };
}

/** Was Ziehen, Zoomen und Drehen an Karte und Blick ändern; Pixel werden in SVG-Einheiten umgerechnet. */
function useGestures(
  svg: RefObject<SVGSVGElement | null>,
  viewWidth: number,
  zoomAt: (factor: number, client: Point) => void,
): Gestures {
  const scale = () => viewWidth / Math.max(1, svg.current?.clientWidth ?? 1);
  const orbit = useOrbitStore((state) => state.orbitBy);
  return { pan: useDragPan(scale), zoomAt, orbit };
}

/** Zeigerposition relativ zur Karte, nicht zum Element darunter (z. B. einem Knopf über dem System). */
function useCursor() {
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const [touch, setTouch] = useState(false);
  const track = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setCursor({ x: event.clientX - box.left, y: event.clientY - box.top });
    setTouch(event.pointerType === 'touch');
  };
  return { cursor, touch, track };
}

/**
 * Ziehen verschiebt, Mausrad und zwei Finger zoomen zum Zeiger hin; rechte Maustaste, Umschalt
 * oder zwei verdrehte Finger drehen und neigen. Bildschirm-Pixel werden in SVG-Einheiten umgerechnet.
 */
export function usePanZoom(
  svg: RefObject<SVGSVGElement | null>,
  viewWidth: number,
  zoomAt: (factor: number, client: Point) => void,
): PanZoomHandlers {
  const { cursor, touch, track } = useCursor();
  const { moveTo, ...pointers } = usePointers(useGestures(svg, viewWidth, zoomAt));
  return {
    cursor,
    touch,
    ...pointers,
    onPointerMove: (event) => {
      track(event);
      moveTo(event);
    },
    onWheel: (event) => zoomAt(wheelFactor(event.deltaY, event.deltaMode), pointOf(event)),
    onContextMenu: (event) => event.preventDefault(),
  };
}
