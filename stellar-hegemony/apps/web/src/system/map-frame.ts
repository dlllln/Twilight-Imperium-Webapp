import type { Bounds } from '../hex-geometry.ts';
import type { ScreenSize } from '../render/view-transform.ts';

/*
 * Die Karte liegt in der Partie ganz im freien Bereich zwischen den Anzeigen (reine Funktionen):
 * Die Ränder sind Bildschirmpixel, daraus entsteht eine viewBox, die die Karte genau dort
 * zeigt. So wird die Karte auf jedem Bildschirm so groß wie möglich, ohne dass etwas sie verdeckt.
 * In der Tischansicht liegt unten das Kommandopult statt oben die Vorratsleiste; die Karte rückt
 * dann bis an die Unterkante des freien Bereichs, damit die eigene Heimat direkt am Pult liegt.
 */

/** Klassische Anzeigen (Vorratsleiste oben) oder Tischansicht (Kommandopult unten). */
export type HudLayout = 'classic' | 'table';
/** Wo die Karte im freien Bereich steht, wenn sie ihn nicht ganz ausfüllt. */
export type FrameAlign = 'center' | 'bottom';

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
/** Tischansicht: oben nur die Spielerleiste, unten das Pult samt eingeklappter Hand. */
const TABLE_WIDE: Insets = { top: 16, right: 432, bottom: 156, left: 226 };
/**
 * Tischansicht auf schmalen Bildschirmen: Spieler oben, darunter frei. Unten liegen übereinander
 * das Pult (96), der Abstand der Ecke darüber (70) und Phase samt Hinweis und zwei bis drei
 * Meldungen (knapp 300). Hochkant ist ohnehin Höhe übrig, die Karte wird dadurch kaum kleiner.
 * Das ist der Mindestwert; mit der Ansage wächst der untere Rand (`tableNarrowBottom`).
 */
const TABLE_NARROW: Insets = { top: 76, right: 12, bottom: 460, left: 12 };

/**
 * Über Pult, angehobener Hand und Phase liegt am schmalen Tisch die Ansage (Pixel, wie in
 * styles.css): höchstens `prompt` hoch bzw. 30 % der Bildhöhe. Die Karte rückt darüber, damit
 * Ziele bei der eigenen Heimat nicht unter der Ansage liegen.
 */
interface PromptStack {
  readonly below: number;
  readonly prompt: number;
}
/** Tablet hochkant: Pult 96, Hand 200, Phase gut 80. */
const TABLET_STACK: PromptStack = { below: 96 + 200 + 84, prompt: 260 };
/** Telefon: Pult 96, Hand 118, Phase gut 70. */
const PHONE_STACK: PromptStack = { below: 96 + 118 + 74, prompt: 182 };
const PROMPT_SHARE = 0.3;
/** So viel der Kartenhöhe darf unten höchstens frei bleiben; der Rest gehört der Karte. */
const BOTTOM_SHARE_MAX = 0.64;

/** Unterer Rand am schmalen Tisch: Ansage samt allem darunter, aber nie mehr als knapp zwei Drittel. */
function tableNarrowBottom(screen: ScreenSize): number {
  const stack = screen.width < NARROW_WIDTH ? PHONE_STACK : TABLET_STACK;
  const wanted = stack.below + Math.min(stack.prompt, screen.height * PROMPT_SHARE);
  return Math.max(TABLE_NARROW.bottom, Math.min(wanted, screen.height * BOTTOM_SHARE_MAX));
}
const WIDE_BY_LAYOUT: Readonly<Record<HudLayout, Insets>> = { classic: WIDE, table: TABLE_WIDE };
const NARROW_BY_LAYOUT: Readonly<Record<HudLayout, Insets>> = {
  classic: NARROW,
  table: TABLE_NARROW,
};

/** Grundränder einer Anordnung, je nach Bildschirmbreite. */
const insetsFor = (layout: HudLayout, small: boolean): Insets =>
  (small ? NARROW_BY_LAYOUT : WIDE_BY_LAYOUT)[layout];
/** Tablets hochkant nutzen dieselbe Anordnung wie schmale Bildschirme. */
const PORTRAIT_WIDTH = 1100;

const narrow = (screen: ScreenSize): boolean =>
  screen.width < NARROW_WIDTH || (screen.width <= PORTRAIT_WIDTH && screen.height >= screen.width);
/**
 * Platz für Benachrichtigungen bleibt nur frei, wenn die Karte dadurch kaum kleiner wird.
 * Am Tisch ist die Karte flacher und breiter; dort bleibt die rechte Spalte auch auf üblichen
 * Laptops frei, damit Meldungen und das Aktionsfeld keine Systeme verdecken.
 */
const KEEP_SCALE: Readonly<Record<HudLayout, number>> = { classic: 0.85, table: 0.6 };

const freeOf = (screen: ScreenSize, insets: Insets): ScreenSize => ({
  width: screen.width - insets.left - insets.right,
  height: screen.height - insets.top - insets.bottom,
});

/** Maßstab, mit dem die Karte den freien Bereich gerade ausfüllt. */
export function fitScale(bounds: Bounds, screen: ScreenSize, insets: Insets): number {
  const free = freeOf(screen, insets);
  return Math.min(free.width / bounds.width, free.height / bounds.height);
}

/** Welche Ränder die Anzeigen bei dieser Bildschirmgröße und Anordnung belegen. */
export function hudInsets(
  bounds: Bounds,
  screen: ScreenSize,
  layout: HudLayout = 'classic',
): Insets {
  const wide = insetsFor(layout, narrow(screen));
  if (narrow(screen) && layout === 'table') return { ...wide, bottom: tableNarrowBottom(screen) };
  if (narrow(screen)) return wide;
  const slim = { ...wide, right: SLIM_RIGHT };
  const keep =
    fitScale(bounds, screen, wide) >= KEEP_SCALE[layout] * fitScale(bounds, screen, slim);
  return keep ? wide : slim;
}

/** Abstand der Karte von der Oberkante des freien Bereichs: mittig oder ganz unten. */
const offsetY = (free: ScreenSize, bounds: Bounds, fit: number, align: FrameAlign): number => {
  const spare = free.height - bounds.height * fit;
  return align === 'bottom' ? spare : spare / 2;
};

/**
 * viewBox, in der die Karte bei der Abbildung „xMidYMid meet“ waagrecht mittig im freien Bereich
 * liegt, senkrecht mittig oder (`bottom`) auf dessen Unterkante.
 * Ohne bekannte Bildgröße (oder ohne freien Platz) bleibt es bei der Karte selbst.
 */
export function frameBounds(
  bounds: Bounds,
  screen: ScreenSize,
  insets: Insets,
  align: FrameAlign = 'center',
): Bounds {
  const fit = fitScale(bounds, screen, insets);
  if (!(fit > 0) || !Number.isFinite(fit)) return bounds;
  const free = freeOf(screen, insets);
  const left = insets.left + (free.width - bounds.width * fit) / 2;
  const top = insets.top + offsetY(free, bounds, fit, align);
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

/**
 * Freier Bereich zwischen den Anzeigen als Rechteck in viewBox-Koordinaten, z. B. um Systeme
 * dort ins Bild zu rücken. Ohne bekannte Bildgröße (oder ohne freien Platz) der ganze Ausschnitt.
 */
export function freeArea(frame: Bounds, screen: ScreenSize, insets: Insets): Bounds {
  const free = freeOf(screen, insets);
  if (screen.height <= 0 || free.width <= 0 || free.height <= 0) return frame;
  const unit = frame.height / screen.height;
  return {
    minX: frame.minX + insets.left * unit,
    minY: frame.minY + insets.top * unit,
    width: free.width * unit,
    height: free.height * unit,
  };
}
