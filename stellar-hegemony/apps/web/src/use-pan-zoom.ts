import { type PointerEvent, type RefObject, useRef, useState, type WheelEvent } from 'react';
import { useGalaxyStore } from './store.ts';
import { stopCamera } from './system/viewport-tween.ts';

/** Zoom je Pixel Mausradweg: eine Raste (100 px) vergrößert um gut ein Viertel. */
const WHEEL_SENSITIVITY = 0.0022;
/** Zeilen- bzw. Seitenschritte mancher Browser in Pixel umrechnen. */
const LINE_PIXELS = 33;
const PAGE_PIXELS = 400;
const MAX_WHEEL_STEP = 2;
/** Ab so vielen Pixeln gilt ein Klick als Ziehen und wählt kein Feld. */
const DRAG_THRESHOLD = 5;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PanZoomHandlers {
  readonly cursor: Point;
  /** Ob die letzte Zeigerbewegung ein Verschieben der Karte war. */
  readonly wasDrag: () => boolean;
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: () => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onWheel: (event: WheelEvent<HTMLElement>) => void;
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

type DragHandlers = Pick<PanZoomHandlers, 'onPointerDown' | 'onPointerUp' | 'wasDrag'> & {
  readonly dragTo: (event: PointerEvent<HTMLElement>) => void;
};

/** Meldet Zieh-Bewegungen in Bildschirm-Pixeln. */
function useDrag(onDrag: (dx: number, dy: number) => void): DragHandlers {
  const drag = useRef<Point | null>(null);
  const travelled = useRef(0);
  return {
    onPointerDown: (event) => {
      drag.current = pointOf(event);
      travelled.current = 0;
    },
    onPointerUp: () => (drag.current = null),
    wasDrag: () => travelled.current > DRAG_THRESHOLD,
    dragTo: (event) => {
      if (drag.current === null) return;
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      travelled.current += Math.hypot(dx, dy);
      onDrag(dx, dy);
      drag.current = pointOf(event);
    },
  };
}

/** Ziehen verschiebt, Mausrad zoomt zum Zeiger hin. Bildschirm-Pixel werden in SVG-Einheiten umgerechnet. */
export function usePanZoom(
  svg: RefObject<SVGSVGElement | null>,
  viewWidth: number,
  zoomAt: (factor: number, client: Point) => void,
): PanZoomHandlers {
  /** Relativ zur Karte, nicht zum Element unter dem Zeiger (z. B. einem Knopf über dem System). */
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const scale = () => viewWidth / Math.max(1, svg.current?.clientWidth ?? 1);
  const { dragTo, ...drag } = useDrag(useDragPan(scale));
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setCursor({ x: event.clientX - box.left, y: event.clientY - box.top });
    dragTo(event);
  };
  return {
    cursor,
    ...drag,
    onPointerMove,
    onWheel: (event) => zoomAt(wheelFactor(event.deltaY, event.deltaMode), pointOf(event)),
  };
}
