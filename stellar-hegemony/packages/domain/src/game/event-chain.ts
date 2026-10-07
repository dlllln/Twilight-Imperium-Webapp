import { evolveGame, type GameEvent } from './game-events.ts';
import type { GameState } from './game-state.ts';

/** Ein Abschnitt eines Ablaufs: liefert Events auf Basis des bis dahin erreichten Zustands. */
export type Stage = (state: GameState) => readonly GameEvent[];

/**
 * Pure Fabrication: führt Abschnitte nacheinander aus; jeder sieht den Zustand
 * nach den Events der vorherigen (z. B. Abwehrfeuer, dann Bodenkampf, dann Kontrolle).
 */
export function chain(state: GameState, stages: readonly Stage[]): readonly GameEvent[] {
  let current = state;
  const events: GameEvent[] = [];
  for (const stage of stages) {
    const next = stage(current);
    events.push(...next);
    current = next.reduce(evolveGame, current);
  }
  return events;
}
