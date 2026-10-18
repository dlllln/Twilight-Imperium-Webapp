import { create } from 'zustand';
import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';

interface MapPointer {
  readonly cursor: { readonly x: number; readonly y: number };
  readonly touch: boolean;
}

/** Pointer coordinates belong to the tooltip, not to the whole galaxy component. */
export const useMapPointer = create<MapPointer>(() => ({ cursor: { x: 0, y: 0 }, touch: false }));

interface QueuedPointer {
  readonly element: HTMLElement;
  readonly x: number;
  readonly y: number;
  readonly touch: boolean;
}

const queuedPointer = (event: PointerEvent<HTMLElement>): QueuedPointer => ({
  element: event.currentTarget,
  x: event.clientX,
  y: event.clientY,
  touch: event.pointerType === 'touch',
});

function publish(point: QueuedPointer | null): void {
  if (point === null) return;
  const box = point.element.getBoundingClientRect();
  useMapPointer.setState({
    cursor: { x: point.x - box.left, y: point.y - box.top },
    touch: point.touch,
  });
}

export function usePointerTracking() {
  const pending = useRef(0);
  const latest = useRef<QueuedPointer | null>(null);
  const flush = useCallback(() => {
    pending.current = 0;
    publish(latest.current);
  }, []);
  useEffect(() => () => cancelAnimationFrame(pending.current), []);
  return useCallback(
    (event: PointerEvent<HTMLElement>) => {
      latest.current = queuedPointer(event);
      if (pending.current !== 0) return;
      pending.current = requestAnimationFrame(flush);
    },
    [flush],
  );
}
