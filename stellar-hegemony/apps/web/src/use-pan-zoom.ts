import { type PointerEvent, type RefObject, useRef, useState, type WheelEvent } from 'react';
import { useGalaxyStore } from './store.ts';

const WHEEL_ZOOM_STEP = 1.1;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PanZoomHandlers {
  readonly cursor: Point;
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

type DragHandlers = Pick<PanZoomHandlers, 'onPointerDown' | 'onPointerUp'> & {
  readonly dragTo: (event: PointerEvent<HTMLElement>) => void;
};

/** Meldet Zieh-Bewegungen in Bildschirm-Pixeln. */
function useDrag(onDrag: (dx: number, dy: number) => void): DragHandlers {
  const drag = useRef<Point | null>(null);
  return {
    onPointerDown: (event) => (drag.current = pointOf(event)),
    onPointerUp: () => (drag.current = null),
    dragTo: (event) => {
      if (drag.current === null) return;
      onDrag(event.clientX - drag.current.x, event.clientY - drag.current.y);
      drag.current = pointOf(event);
    },
  };
}

/** Ziehen verschiebt, Mausrad zoomt. Bildschirm-Pixel werden in SVG-Einheiten umgerechnet. */
export function usePanZoom(
  svg: RefObject<SVGSVGElement | null>,
  viewWidth: number,
): PanZoomHandlers {
  const { zoomBy, panBy } = useGalaxyStore();
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const scale = () => viewWidth / Math.max(1, svg.current?.clientWidth ?? 1);
  const { dragTo, ...drag } = useDrag((dx, dy) => panBy(dx * scale(), dy * scale()));
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    setCursor({ x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY });
    dragTo(event);
  };
  return { cursor, ...drag, onPointerMove, onWheel: (event) => zoomBy(wheelFactor(event)) };
}
