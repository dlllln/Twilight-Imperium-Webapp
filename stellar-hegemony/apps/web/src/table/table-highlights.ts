import type { Highlight } from '../render/scene-model.ts';
import { parseTargetKey, type TargetState } from './target-ref.ts';

/*
 * Ziele der Entscheidung auf der Karte: erlaubte Systeme leuchten als 'legal', gewählte als
 * 'chosen'. Das aktive System behält seinen Rahmen.
 */

const LOOKS: Readonly<Record<TargetState, Highlight | null>> = {
  legal: 'legal',
  chosen: 'chosen',
  blocked: null,
};

export function withTableHighlights(
  base: ReadonlyMap<string, Highlight>,
  targets: ReadonlyMap<string, TargetState>,
): ReadonlyMap<string, Highlight> {
  const merged = new Map(base);
  for (const [key, state] of targets) {
    const ref = parseTargetKey(key);
    const look = LOOKS[state];
    if (ref?.kind !== 'system' || look === null || base.get(ref.id) === 'active') continue;
    merged.set(ref.id, look);
  }
  return merged;
}
