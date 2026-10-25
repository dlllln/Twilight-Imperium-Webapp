/*
 * Rollen in der Ansage: Ein Baustein (Werft, Handelsmatte, Sockel) soll mit seinem wichtigsten
 * Teil ganz über der Leiste des Siegels stehen, die unten klebt. Gerollt wird so wenig wie nötig
 * und bündig an der Oberkante einer Zeile der Ansage, damit oben nie eine halbe Textzeile stehen
 * bleibt. Die Rechnung ist eine reine Funktion, das Messen ein dünner Teil darum.
 */

/** Abstand zum oberen Rand der Ansage in Pixeln. */
const EDGE = 6;

export interface ScrollPlan {
  /** Kleinste Rollhöhe, bei der der wichtige Teil ganz über der Leiste steht. */
  readonly least: number;
  /** Größte Rollhöhe, bei der der Anfang des Bausteins noch zu sehen ist. */
  readonly most: number;
  /** Rollhöhen, bei denen eine Zeile der Ansage bündig oben steht. */
  readonly rows: readonly number[];
  /** Die Rollhöhe jetzt. */
  readonly current: number;
}

/** Ob bei diesem Plan der Baustein samt wichtigem Teil überhaupt zugleich Platz hat. */
export const fits = (plan: ScrollPlan): boolean => plan.least <= plan.most;

/**
 * Die nächste bündige Rollhöhe zwischen `least` und `most`: Steht schon alles im Bild, bleibt es;
 * von oben kommend die erste, von unten kommend die letzte passende Zeile. Gibt es keine, genau so
 * weit wie nötig; ist der Baustein höher als die Ansage, steht sein Anfang oben. Nie unter 0.
 */
export function snappedScroll(plan: ScrollPlan): number {
  const { least, most, rows, current } = plan;
  if (current >= least && current <= most) return current;
  const fitting = rows.filter((row) => row >= least && row <= most);
  const fallback = current < least && fits(plan) ? least : most;
  if (fitting.length === 0) return Math.max(0, fallback);
  return Math.max(0, current < least ? Math.min(...fitting) : Math.max(...fitting));
}

/** Lage einer Kante eines Elements in der gerollten Fläche der Ansage. */
function offsetIn(scroller: HTMLElement, element: Element, edge: 'top' | 'bottom'): number {
  const box = scroller.getBoundingClientRect();
  return element.getBoundingClientRect()[edge] - box.top + scroller.scrollTop;
}

const BAR = '.table-prompt-actions';

/** Ein Maß in Pixeln aus dem berechneten Stil; leer oder `normal` zählt als 0. */
const pixels = (value: string): number => Number.parseFloat(value) || 0;

/**
 * Oberkante einer Zeile der Ansage. Die klebende Leiste meldet, wo sie gerade klebt; ihre Zeile
 * liegt aber dort, wo sie ohne Kleben stünde: unter ihrem Vorgänger samt Abstand.
 */
function rowTop(scroller: HTMLElement, child: Element): number {
  const previous = child.previousElementSibling;
  if (!child.matches(BAR) || previous === null) return offsetIn(scroller, child, 'top');
  const gap = pixels(getComputedStyle(scroller).rowGap) + pixels(getComputedStyle(child).marginTop);
  return offsetIn(scroller, previous, 'bottom') + gap;
}

/** Höhe der klebenden Leiste mit Ausweg und Siegel; ohne Leiste 0. */
function barHeight(scroller: HTMLElement): number {
  const bar = scroller.querySelector(`:scope > ${BAR}`);
  return bar instanceof HTMLElement ? bar.offsetHeight : 0;
}

/** Was der Baustein `block` mit seinem wichtigen Teil `focus` in dieser Ansage zum Rollen braucht. */
export function scrollPlanOf(scroller: HTMLElement, block: Element, focus: Element): ScrollPlan {
  const view = scroller.clientHeight - barHeight(scroller);
  const end = scroller.scrollHeight - scroller.clientHeight;
  const tops = [...scroller.children].map((child) => rowTop(scroller, child) - EDGE);
  return {
    least: offsetIn(scroller, focus, 'bottom') + EDGE - view,
    most: Math.min(end, offsetIn(scroller, block, 'top') - EDGE),
    rows: [0, ...tops],
    current: scroller.scrollTop,
  };
}

/**
 * Rollt die umgebende Ansage, bis `block` bis einschließlich `focus` zu sehen ist; außerhalb
 * einer Ansage nichts. Mit `onlyIfFits` bleibt sie stehen, wenn beides nicht zugleich passt.
 */
export function revealInPrompt(
  block: HTMLElement,
  focus: Element = block,
  onlyIfFits = false,
): void {
  const scroller = block.closest('.table-prompt');
  if (!(scroller instanceof HTMLElement)) return;
  const plan = scrollPlanOf(scroller, block, focus);
  if (onlyIfFits && !fits(plan)) return;
  const next = snappedScroll(plan);
  if (next !== plan.current) scroller.scrollTop = next;
}
