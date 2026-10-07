import type { ActionPhaseState } from '../phases/turn-state.ts';
import type { PlayerId } from '../shared/ids.ts';

/** RR 4: Nächster Spieler in Initiativreihenfolge, der noch nicht gepasst hat. */
export function nextActivePlayer(
  turn: ActionPhaseState,
  current: PlayerId,
  passed: readonly PlayerId[],
): PlayerId | null {
  const start = turn.order.indexOf(current);
  const rotated = [...turn.order.slice(start + 1), ...turn.order.slice(0, start + 1)];
  return rotated.find((player) => !passed.includes(player)) ?? null;
}
