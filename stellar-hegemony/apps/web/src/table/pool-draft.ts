import { COMMAND_POOLS, type CommandPool, type PoolCounts } from '@stellar/domain';
import type { DraftZone } from './target-ref.ts';

/*
 * Entwurf einer Markerverteilung (reine Funktionen). Neue Marker liegen zuerst lose in der
 * Schale; jeder Zug legt genau einen Marker von einem Feld auf ein anderes. Der Boden hält bei
 * der Führung die alten Marker fest, in der Statusphase und bei der Kriegsführung ist er leer.
 */

export interface PoolDraft {
  /** Führung: die bisherigen Pools (alte Marker bleiben liegen); sonst überall null. */
  readonly floor: PoolCounts;
  /** Geplanter Inhalt der Leisten. */
  readonly pools: PoolCounts;
  /** Noch nicht gelegte Marker („Neue Marker“). */
  readonly loose: number;
  /** Woher zusätzliche Marker kommen (für die Buchführung des Pults). */
  readonly source: 'reinforcements' | 'board';
}

const EMPTY: PoolCounts = { tactic: 0, fleet: 0, strategy: 0 };

export const poolSum = (pools: PoolCounts): number =>
  COMMAND_POOLS.reduce((sum, pool) => sum + pools[pool], 0);

export function poolDraft(
  current: PoolCounts,
  gained: number,
  fixed: boolean,
  source: PoolDraft['source'] = 'reinforcements',
): PoolDraft {
  return { floor: fixed ? current : EMPTY, pools: current, loose: Math.max(0, gained), source };
}

const countIn = (draft: PoolDraft, zone: DraftZone): number =>
  zone === 'loose' ? draft.loose : draft.pools[zone];

const floorOf = (draft: PoolDraft, zone: DraftZone): number =>
  zone === 'loose' ? 0 : draft.floor[zone];

/** Ein Marker darf wandern, wenn das Ausgangsfeld mehr als seinen Boden hält. */
export function canMove(draft: PoolDraft, from: DraftZone, to: DraftZone): boolean {
  return from !== to && countIn(draft, from) > floorOf(draft, from);
}

function shifted(draft: PoolDraft, zone: DraftZone, delta: number): PoolDraft {
  if (zone === 'loose') return { ...draft, loose: draft.loose + delta };
  return { ...draft, pools: { ...draft.pools, [zone]: draft.pools[zone] + delta } };
}

/** Legt einen Marker um; ein unerlaubter Zug ändert nichts. */
export function moveToken(draft: PoolDraft, from: DraftZone, to: DraftZone): PoolDraft {
  if (!canMove(draft, from, to)) return draft;
  return shifted(shifted(draft, from, -1), to, 1);
}

/** Die neu gelegten Marker je Leiste (Pools minus Boden), z. B. für die Führung. */
export function addedTokens(draft: PoolDraft): PoolCounts {
  const added = (pool: CommandPool) => draft.pools[pool] - draft.floor[pool];
  return { tactic: added('tactic'), fleet: added('fleet'), strategy: added('strategy') };
}
