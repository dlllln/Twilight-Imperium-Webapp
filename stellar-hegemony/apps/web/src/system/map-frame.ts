import type { Bounds } from '../hex-geometry.ts';
import type { ScreenSize } from '../render/view-transform.ts';

/*
 * Die Karte liegt in der Partie ganz im freien Bereich zwischen den Anzeigen (reine Funktionen):
 * Die Ränder sind Bildschirmpixel, daraus entsteht eine viewBox, die die Karte genau dort
 * zeigt. So wird die Karte auf jedem Bildschirm so groß wie möglich, ohne dass etwas sie verdeckt.
 */

/** Freizuhaltende Bildschirmränder in Pixeln. */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Vorräte oben, Spieler links, eingeklappte Hand unten, rechts Benachrichtigungen und Reiter. */
const WIDE: Insets = { top: 76, right: 432, bottom: 78, left: 226 };
/** Rechts nur die Reiter der Übersicht; Benachrichtigungen liegen dann kurz über der Karte. */
const SLIM_RIGHT = 84;
/** Schmale Bildschirme: Spieler und Vorräte oben übereinander, Meldungen unten über der Hand. */
const NARROW: Insets = { top: 128, right: 12, bottom: 230, left: 12 };
const NARROW_WIDTH = 760;
/** Tablets hochkant nutzen dieselbe Anordnung wie schmale Bildschirme. */
const PORTRAIT_WIDTH = 1100;

const narrow = (screen: ScreenSize): boolean =>
  screen.width < NARROW_WIDTH || (screen.width <= PORTRAIT_WIDTH && screen.height >= screen.width);
/** Platz für Benachrichtigungen bleibt nur frei, wenn die Karte dadurch kaum kleiner wird. */
const KEEP_SCALE = 0.85;

const freeOf = (screen: ScreenSize, insets: Insets): ScreenSize => ({
  width: screen.width - insets.left - insets.right,
  height: screen.height - insets.top - insets.bottom,
});

/** Maßstab, mit dem die Karte den freien Bereich gerade ausfüllt. */
export function fitScale(bounds: Bounds, screen: ScreenSize, insets: Insets): number {
  const free = freeOf(screen, insets);
  return Math.min(free.width / bounds.width, free.height / bounds.height);
}

/** Welche Ränder die Anzeigen bei dieser Bildschirmgröße belegen. */
export function hudInsets(bounds: Bounds, screen: ScreenSize): Insets {
  if (narrow(screen)) return NARROW;
  const slim = { ...WIDE, right: SLIM_RIGHT };
  const keep = fitScale(bounds, screen, WIDE) >= KEEP_SCALE * fitScale(bounds, screen, slim);
  return keep ? WIDE : slim;
}

/**
 * viewBox, in der die Karte bei der Abbildung „xMidYMid meet“ mittig im freien Bereich liegt.
 * Ohne bekannte Bildgröße (oder ohne freien Platz) bleibt es bei der Karte selbst.
 */
export function frameBounds(bounds: Bounds, screen: ScreenSize, insets: Insets): Bounds {
  const fit = fitScale(bounds, screen, insets);
  if (!(fit > 0) || !Number.isFinite(fit)) return bounds;
  const free = freeOf(screen, insets);
  const left = insets.left + (free.width - bounds.width * fit) / 2;
  const top = insets.top + (free.height - bounds.height * fit) / 2;
  return {
    minX: bounds.minX - left / fit,
    minY: bounds.minY - top / fit,
    width: screen.width / fit,
    height: screen.height / fit,
  };
}

/** Freies Band (oben, unten) in viewBox-Koordinaten, z. B. für die Knöpfe am System. */
export function freeBand(frame: Bounds, screen: ScreenSize, insets: Insets) {
  if (screen.height <= 0) return { top: frame.minY, bottom: frame.minY + frame.height };
  const unit = frame.height / screen.height;
  return {
    top: frame.minY + insets.top * unit,
    bottom: frame.minY + (screen.height - insets.bottom) * unit,
  };
}
