import type { Point } from './carry-store.ts';
import { parseTargetKey, type TargetRef, targetKey } from './target-ref.ts';

export type PointQuery = Pick<Document, 'elementsFromPoint'>;

/** Das Ziel eines Elements: es selbst oder ein Vorfahr mit lesbarem `data-target`. */
function targetOf(element: Element): TargetRef | null {
  const key = element.closest('[data-target]')?.getAttribute('data-target');
  return key == null ? null : parseTargetKey(key);
}

/**
 * Das oberste erlaubte Ziel unter einem Punkt; Elemente ohne Ziel werden übersprungen. Liegt ein
 * nicht erlaubtes Ziel darüber (etwa ein Zahlungsring auf dem Hex der Produktion), fällt das
 * Stück trotzdem auf das erlaubte darunter. Ist keines erlaubt, gilt das oberste Ziel.
 */
export function dropTargetAt(
  point: Point,
  doc: PointQuery = document,
  legal: ReadonlySet<string> | null = null,
): TargetRef | null {
  let topmost: TargetRef | null = null;
  for (const element of doc.elementsFromPoint(point.x, point.y)) {
    const target = targetOf(element);
    if (target === null) continue;
    if (legal === null || legal.has(targetKey(target))) return target;
    topmost ??= target;
  }
  return topmost;
}
