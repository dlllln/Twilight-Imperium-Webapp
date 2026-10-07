import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CommandSheet, type PoolCounts } from '../src/index.ts';

const sheet = (pools: PoolCounts) => {
  const result = CommandSheet.of(pools);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe('Kommandotafel (RR 45/46)', () => {
  it('RR 46.1: Start mit 3 Taktik, 3 Flotte, 2 Strategie', () => {
    const start = sheet({ tactic: 3, fleet: 3, strategy: 2 });
    expect(start.total).toBe(8);
    expect(start.tokensIn('fleet')).toBe(3);
  });

  it('RR 46.4: Taktikaktion gibt einen Marker aus dem Taktikpool aus', () => {
    const spent = sheet({ tactic: 1, fleet: 3, strategy: 2 }).spend('tactic');
    expect(spent.ok && spent.value.tokensIn('tactic')).toBe(0);
  });

  it('RR 46.4: ohne Marker im Pool ist keine Ausgabe möglich', () => {
    const spent = sheet({ tactic: 0, fleet: 3, strategy: 0 }).spend('strategy');
    expect(spent).toMatchObject({ ok: false, error: { code: 'commandSheet.poolEmpty' } });
  });

  it('RR 46.2: erhaltene Marker landen im gewählten Pool', () => {
    expect(sheet({ tactic: 0, fleet: 0, strategy: 0 }).gain('fleet', 2).tokensIn('fleet')).toBe(2);
  });

  it('negative Pools sind ungültig', () => {
    expect(CommandSheet.of({ tactic: -1, fleet: 0, strategy: 0 }).ok).toBe(false);
  });

  it('RR 73: Umverteilen erhält die Gesamtzahl der Marker', () => {
    const pools = fc.record({ tactic: fc.nat(10), fleet: fc.nat(10), strategy: fc.nat(10) });
    fc.assert(
      fc.property(pools, pools, (from, to) => {
        const result = sheet(from).redistribute(to);
        const sameTotal =
          from.tactic + from.fleet + from.strategy === to.tactic + to.fleet + to.strategy;
        return result.ok === sameTotal;
      }),
    );
  });

  it('Umverteilen in negative Pools ist ungültig', () => {
    expect(
      sheet({ tactic: 1, fleet: 1, strategy: 1 }).redistribute({
        tactic: 4,
        fleet: -1,
        strategy: 0,
      }).ok,
    ).toBe(false);
  });
});
