import type { Point } from './carry-store.ts';
import { parseTargetKey, type TargetRef } from './target-ref.ts';

export type PointQuery = Pick<Document, 'elementsFromPoint'>;

/** Das Ziel eines Elements: es selbst oder ein Vorfahr mit lesbarem `data-target`. */
function targetOf(element: Element): TargetRef | null {
  const key = element.closest('[data-target]')?.getAttribute('data-target');
  return key == null ? null : parseTargetKey(key);
}

/** Das oberste Ziel unter einem Punkt; Elemente ohne Ziel werden übersprungen. */
export function dropTargetAt(point: Point, doc: PointQuery = document): TargetRef | null {
  for (const element of doc.elementsFromPoint(point.x, point.y)) {
    const target = targetOf(element);
    if (target !== null) return target;
  }
  return null;
}
