import { type RefObject, useEffect } from 'react';

/*
 * Wo eine Auslage in der freien Mitte endet (Forschungsauslage, Kampfmatte, Agendatisch):
 * Hochkant und auf Telefonen steht die Ecke mit Phase und Ansage darunter; die Auslage endet
 * knapp darüber, wie hoch die Ansage gerade auch ist. Im Querformat gilt die feste Rechnung des
 * Stylesheets (`--spread-bottom`).
 */

/** Hochkant und Telefon: Die Ecke mit Phase und Ansage steht unter der Auslage (styles.css). */
const STACKED = '(max-width: 760px), (max-width: 1100px) and (orientation: portrait)';
/** Luft zwischen Auslage und Ecke in Pixeln. */
const GAP = 10;

const stacked = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(STACKED).matches;

/** Abstand vom unteren Rand bis über die Ecke; ohne Ecke `null`. */
function floorOf(spread: HTMLElement): string | null {
  const corner = document.querySelector('.hud-corner');
  const parent = spread.offsetParent;
  if (corner === null || !(parent instanceof HTMLElement)) return null;
  const bottom = parent.getBoundingClientRect().bottom - corner.getBoundingClientRect().top;
  return `${String(Math.round(bottom + GAP))}px`;
}

/**
 * Untereinander gestapelt endet die Auslage knapp über der Ecke, wie hoch die Ansage gerade auch
 * ist; die feste Rechnung in research-spread.css gilt nur ohne Messung (etwa vor dem ersten Bild).
 */
function placeMat(spread: HTMLElement): void {
  const floor = stacked() ? floorOf(spread) : null;
  if (floor === null) spread.style.removeProperty('--spread-bottom');
  else spread.style.setProperty('--spread-bottom', floor);
}

/** Misst nach jedem Bild und wenn die Ecke ihre Größe ändert (Ansage wächst, Meldungen). */
export function useMatFloor(ref: RefObject<HTMLElement | null>, open: boolean): void {
  useEffect(() => {
    if (ref.current !== null) placeMat(ref.current);
  });
  useEffect(() => {
    const spread = ref.current;
    const corner = document.querySelector('.hud-corner');
    if (spread === null || corner === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => placeMat(spread));
    observer.observe(corner);
    return () => observer.disconnect();
  }, [ref, open]);
}
