import type { CommandPool } from '@stellar/domain';
import { type PoolDraft, poolSum } from '../table/pool-draft.ts';
import type { SheetModel } from './sheet-model.ts';

/*
 * Buchführung der Kommandomarker (reine Funktionen): Jeder Marker trägt eine feste Nummer, damit
 * er beim Wechsel des Feldes sichtbar dorthin wandert, statt zu verschwinden und neu aufzutauchen.
 * Während einer Verteilung liegen die neuen Marker lose in der Schale („loose“).
 */

export type Zone = CommandPool | 'reinforcements' | 'board' | 'loose';

export const ZONES: readonly Zone[] = [
  'reinforcements',
  'loose',
  'tactic',
  'fleet',
  'strategy',
  'board',
];

export type ZoneCounts = Readonly<Record<Zone, number>>;

/** Die Nummern der Marker je Feld. */
export type TokenLedger = Readonly<Record<Zone, readonly number[]>>;

const NONE: ZoneCounts = {
  reinforcements: 0,
  loose: 0,
  tactic: 0,
  fleet: 0,
  strategy: 0,
  board: 0,
};

/** Der geplante Stand: Leisten und Schale laut Entwurf, die Mehrmarker fehlen an ihrer Quelle. */
function planned(counts: ZoneCounts, plan: PoolDraft): ZoneCounts {
  const extra = poolSum(plan.pools) + plan.loose - poolSum(counts);
  const source = plan.source;
  return { ...counts, ...plan.pools, loose: plan.loose, [source]: counts[source] - extra };
}

/**
 * Wie viele Marker in jedem Feld liegen; ohne Pult überall null. Mit einem Entwurf zeigt das Pult
 * die geplante Verteilung, die Gesamtzahl bleibt dabei gleich.
 */
export function zoneCounts(model: SheetModel | null, plan: PoolDraft | null = null): ZoneCounts {
  if (model === null) return NONE;
  const counts = {
    ...NONE,
    ...model.summary.pools,
    reinforcements: model.reinforcements,
    board: model.onBoard,
  };
  return plan === null ? counts : planned(counts, plan);
}

const total = (counts: ZoneCounts): number => ZONES.reduce((sum, zone) => sum + counts[zone], 0);

const byZone = (pick: (zone: Zone) => readonly number[]): TokenLedger =>
  Object.fromEntries(ZONES.map((zone) => [zone, pick(zone)])) as Record<Zone, readonly number[]>;

/** Nummeriert neu: 0 bis n−1 in der Reihenfolge der Felder. */
export function freshLedger(counts: ZoneCounts): TokenLedger {
  let next = 0;
  return byZone((zone) => Array.from({ length: counts[zone] }, () => next++));
}

interface Surplus {
  readonly kept: TokenLedger;
  readonly loose: readonly number[];
}

/** Nimmt schrumpfenden Feldern die letzten Marker ab. */
function surplus(prev: TokenLedger, next: ZoneCounts): Surplus {
  const loose: number[] = [];
  const kept = byZone((zone) => {
    const ids = prev[zone];
    const keep = Math.min(ids.length, next[zone]);
    loose.push(...ids.slice(keep));
    return ids.slice(0, keep);
  });
  return { kept, loose };
}

/** Legt die frei gewordenen Marker hinten in die wachsenden Felder. */
function deposit({ kept, loose }: Surplus, next: ZoneCounts): TokenLedger {
  let taken = 0;
  return byZone((zone) => {
    const missing = next[zone] - kept[zone].length;
    const added = loose.slice(taken, taken + missing);
    taken += missing;
    return [...kept[zone], ...added];
  });
}

/** Neue Anzahlen bei gleicher Gesamtzahl: Marker wandern, alle anderen behalten ihre Nummer. */
export function rebalance(prev: TokenLedger, next: ZoneCounts): TokenLedger {
  const before = ZONES.reduce((sum, zone) => sum + prev[zone].length, 0);
  if (before !== total(next)) return freshLedger(next);
  return deposit(surplus(prev, next), next);
}
