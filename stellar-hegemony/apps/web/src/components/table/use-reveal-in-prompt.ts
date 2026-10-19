import { type RefObject, useEffect } from 'react';

/*
 * Hebt sich zum Bezahlen die Planetenreihe, wird die Ansage niedriger. Damit Messleiste und
 * Knöpfe darunter nicht aus dem sichtbaren Teil rutschen, rollt die Ansage zu ihnen, sobald die
 * Messleiste erscheint und immer wenn die Ansage ihre Höhe ändert.
 */

/** Abstand zum Rand der Ansage in Pixeln. */
const EDGE = 8;

/** Wie weit die Ansage rollen muss: bis zum Ende des Formulars, aber nie über die Messleiste. */
export function revealDelta(scroller: DOMRect, meter: DOMRect, block: DOMRect): number {
  const toBottom = Math.max(0, block.bottom - scroller.bottom + EDGE);
  return Math.min(toBottom, meter.top - scroller.top - EDGE);
}

function reveal(meter: HTMLElement): void {
  const scroller = meter.closest('.table-prompt');
  if (!(scroller instanceof HTMLElement)) return;
  const block = meter.closest('.choice-form') ?? meter.parentElement ?? meter;
  const box = scroller.getBoundingClientRect();
  const delta = revealDelta(box, meter.getBoundingClientRect(), block.getBoundingClientRect());
  if (delta !== 0) scroller.scrollTop += delta;
}

/** Hält das Element samt folgenden Knöpfen in der Ansage sichtbar, solange es steht. */
export function useRevealInPrompt(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const meter = ref.current;
    const scroller = meter?.closest('.table-prompt');
    if (meter == null || !(scroller instanceof HTMLElement)) return;
    reveal(meter);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => reveal(meter));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [ref]);
}
