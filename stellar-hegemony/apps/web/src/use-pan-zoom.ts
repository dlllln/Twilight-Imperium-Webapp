import { type PointerEvent, type RefObject, useRef, useState, type WheelEvent } from 'react';
import { useGalaxyStore } from './store.ts';

const WHEEL_ZOOM_STEP = 1.1;
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

const pointOf = (event: PointerEvent<HTMLElement>): Point => ({
  x: event.clientX,
  y: event.clientY,
});

const wheelFactor = (event: WheelEvent<HTMLElement>): number =>
  event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;

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

/** Ziehen verschiebt, Mausrad zoomt (über `zoomBy`, damit tiefes Zoomen ein System öffnet). Bildschirm-Pixel werden in SVG-Einheiten umgerechnet. */
export function usePanZoom(
  svg: RefObject<SVGSVGElement | null>,
  viewWidth: number,
  zoomBy: (factor: number) => void,
): PanZoomHandlers {
  const panBy = useGalaxyStore((state) => state.panBy);
  /** Relativ zur Karte, nicht zum Element unter dem Zeiger (z. B. einem Knopf über dem System). */
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const scale = () => viewWidth / Math.max(1, svg.current?.clientWidth ?? 1);
  const { dragTo, ...drag } = useDrag((dx, dy) => panBy(dx * scale(), dy * scale()));
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setCursor({ x: event.clientX - box.left, y: event.clientY - box.top });
    dragTo(event);
  };
  return { cursor, ...drag, onPointerMove, onWheel: (event) => zoomBy(wheelFactor(event)) };
}
