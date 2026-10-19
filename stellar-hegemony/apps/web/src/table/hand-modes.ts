import type { TableSpecId } from './spec-types.ts';
import type { TableDecision } from './use-table-decision.ts';

/*
 * Wozu die Hand gerade dient: Karten ausspielen (üblich), Karten zum Ablegen vormerken (über dem
 * Limit) oder im offenen Zeitfenster reagieren. Die Hand fragt nur hier und kennt die
 * Entscheidungen selbst nicht.
 */

export type HandMode = 'play' | 'discard' | 'reaction';

const MODES: Readonly<Partial<Record<TableSpecId, HandMode>>> = {
  discard: 'discard',
  reaction: 'reaction',
};

/** Die Art der Hand zur offenen Tischentscheidung; ohne eine solche wird ausgespielt. */
export function handModeOf(decision: TableDecision | null): HandMode {
  const specId = decision?.specId ?? null;
  return specId === null ? 'play' : (MODES[specId] ?? 'play');
}
