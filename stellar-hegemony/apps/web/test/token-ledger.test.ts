// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  freshLedger,
  rebalance,
  type TokenLedger,
  ZONES,
  type ZoneCounts,
} from '../src/hud/token-ledger.ts';
import { useTokenLedger } from '../src/hud/use-sheet.ts';

const START: ZoneCounts = { reinforcements: 8, tactic: 3, fleet: 3, strategy: 2, board: 0 };

const allIds = (ledger: TokenLedger): number[] =>
  ZONES.flatMap((zone) => ledger[zone]).sort((a, b) => a - b);

describe('Marker wandern zwischen den Feldern des Pults', () => {
  it('eine Systemaktivierung schiebt genau einen Taktikmarker auf die Karte, die übrigen behalten ihre Nummer', () => {
    const start = freshLedger(START);
    expect(start.tactic).toEqual([8, 9, 10]);
    const next = rebalance(start, { ...START, tactic: 2, board: 1 });
    expect(next.tactic).toEqual([8, 9]);
    expect(next.board).toEqual([10]);
    expect(next.reinforcements).toEqual(start.reinforcements);
    expect(next.fleet).toEqual(start.fleet);
    expect(next.strategy).toEqual(start.strategy);
  });

  it('die Statusphase holt Marker aus dem Nachschub in die Pools', () => {
    const played = rebalance(freshLedger(START), { ...START, tactic: 1, strategy: 1, board: 3 });
    const status = rebalance(played, {
      reinforcements: 6,
      tactic: 4,
      fleet: 3,
      strategy: 3,
      board: 0,
    });
    expect(status.reinforcements).toEqual([0, 1, 2, 3, 4, 5]);
    expect(status.tactic.slice(0, 1)).toEqual([8]);
    expect(status.tactic).toHaveLength(4);
    expect(status.strategy).toHaveLength(3);
    expect(status.board).toEqual([]);
  });

  it('keine Nummer geht verloren oder doppelt', () => {
    const counts: readonly ZoneCounts[] = [
      { reinforcements: 2, tactic: 5, fleet: 4, strategy: 3, board: 2 },
      { reinforcements: 10, tactic: 0, fleet: 6, strategy: 0, board: 0 },
      { reinforcements: 0, tactic: 1, fleet: 1, strategy: 1, board: 13 },
    ];
    const last = counts.reduce(rebalance, freshLedger(START));
    expect(allIds(last)).toEqual(Array.from({ length: 16 }, (_, id) => id));
    expect(ZONES.map((zone) => last[zone].length)).toEqual([0, 1, 1, 1, 13]);
  });

  it('bei geänderter Gesamtzahl wird neu verteilt', () => {
    const more: ZoneCounts = { ...START, reinforcements: 9 };
    expect(rebalance(freshLedger(START), more)).toEqual(freshLedger(more));
  });

  it('der Hook merkt sich die Nummern über neue, gleiche Anzahlen hinweg', () => {
    const { result, rerender } = renderHook((counts: ZoneCounts) => useTokenLedger(counts), {
      initialProps: START,
    });
    const first = result.current;
    rerender({ ...START });
    expect(result.current).toBe(first);
    rerender({ ...START, tactic: 2, board: 1 });
    expect(result.current.board).toEqual([10]);
  });
});
