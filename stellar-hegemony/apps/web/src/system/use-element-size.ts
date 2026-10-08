import { type RefObject, useEffect, useState } from 'react';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Größe eines Elements, aktualisiert bei jeder Änderung (für Beschriftungen über Pixi). */
export function useElementSize(element: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const target = element.current;
    if (target === null) return;
    const measure = () => setSize({ width: target.clientWidth, height: target.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [element]);
  return size;
}
