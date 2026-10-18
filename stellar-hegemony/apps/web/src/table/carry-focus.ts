import { useEffect } from 'react';
import { type CarryNews, useCarryStore } from './carry-store.ts';
import { targetKey } from './target-ref.ts';

/*
 * Der Fokus folgt einem per Tastatur getragenen Stück: Nach dem Aufnehmen springt er auf das
 * erste erlaubte Ziel, Tab und Umschalt+Tab kreisen nur durch die erlaubten Ziele. Nach dem
 * Ablegen oder Zurücklegen landet er wieder auf einem Stück (oder dem Siegel), nie im Leeren.
 */

type Focusable = HTMLElement | SVGElement;

const pieceAt = (key: string): Focusable | null =>
  document.querySelector<HTMLElement>(`[data-piece="${key}"]`);

/** Die erlaubten Ziele des getragenen Stücks, in der Reihenfolge des Dokuments. */
function legalElements(): Focusable[] {
  const { legal } = useCarryStore.getState();
  const targets = document.querySelectorAll<HTMLElement>('[data-target]');
  return [...targets].filter((element) => legal.has(element.getAttribute('data-target') ?? ''));
}

/** Nach dem Ablegen: das Stück selbst, sonst das oberste Stück am Ziel, sonst das Siegel. */
function settledFocus(news: CarryNews): Focusable | null {
  const seal = document.querySelector<HTMLElement>('[data-testid="confirm"]:not(:disabled)');
  return pieceAt(targetKey(news.piece)) ?? pieceAt(targetKey(news.ref)) ?? seal;
}

function focusAfter(news: CarryNews): void {
  const next = news.kind === 'carried' ? (legalElements()[0] ?? null) : settledFocus(news);
  next?.focus();
}

function nextIndex(ring: readonly Focusable[], back: boolean): number {
  const at = ring.findIndex((element) => element === document.activeElement);
  if (at < 0) return back ? ring.length - 1 : 0;
  return (at + (back ? -1 : 1) + ring.length) % ring.length;
}

/** Tab beim Tragen per Tastatur: weiter zum nächsten erlaubten Ziel statt durch die ganze Seite. */
function tabWhileCarrying(event: KeyboardEvent): void {
  const { piece, mode } = useCarryStore.getState();
  if (event.key !== 'Tab' || piece === null || mode !== 'keyboard') return;
  const ring = legalElements();
  if (ring.length === 0) return;
  event.preventDefault();
  ring[nextIndex(ring, event.shiftKey)]?.focus();
}

/** `seen`: Meldungen bis zu dieser Nummer stammen von vor dem Erscheinen und bewegen nichts. */
export function useCarryFocus(news: CarryNews | null, seen: number): void {
  useEffect(() => {
    if (news === null || news.serial <= seen || news.mode !== 'keyboard') return;
    focusAfter(news);
  }, [news, seen]);
  useEffect(() => {
    window.addEventListener('keydown', tabWhileCarrying, true);
    return () => {
      window.removeEventListener('keydown', tabWhileCarrying, true);
    };
  }, []);
}
