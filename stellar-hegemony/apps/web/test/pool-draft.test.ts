import { describe, expect, it } from 'vitest';
import { addedTokens, canMove, moveToken, poolDraft, poolSum } from '../src/table/pool-draft.ts';
import { DRAFT_ZONES } from '../src/table/target-ref.ts';

const POOLS = { tactic: 3, fleet: 3, strategy: 2 };

const everything = (draft: ReturnType<typeof poolDraft>) => poolSum(draft.pools) + draft.loose;

describe('Entwurf einer Markerverteilung', () => {
  it('neue Marker liegen zuerst lose in der Schale', () => {
    const draft = poolDraft(POOLS, 3, true);
    expect(draft.loose).toBe(3);
    expect(draft.pools).toEqual(POOLS);
    expect(draft.source).toBe('reinforcements');
    expect(addedTokens(draft)).toEqual({ tactic: 0, fleet: 0, strategy: 0 });
    expect(poolDraft(POOLS, 0, false, 'board').source).toBe('board');
  });

  it('ein loser Marker wandert auf die Taktikleiste', () => {
    const draft = moveToken(poolDraft(POOLS, 2, true), 'loose', 'tactic');
    expect(draft.loose).toBe(1);
    expect(draft.pools.tactic).toBe(4);
    expect(addedTokens(draft)).toEqual({ tactic: 1, fleet: 0, strategy: 0 });
  });

  it('bei der Führung lassen sich alte Marker nicht zurücknehmen', () => {
    const draft = poolDraft(POOLS, 1, true);
    expect(canMove(draft, 'tactic', 'loose')).toBe(false);
    expect(canMove(draft, 'fleet', 'strategy')).toBe(false);
    expect(moveToken(draft, 'tactic', 'fleet')).toBe(draft);
    const placed = moveToken(draft, 'loose', 'fleet');
    expect(canMove(placed, 'fleet', 'loose')).toBe(true);
    expect(moveToken(placed, 'fleet', 'loose')).toEqual(draft);
  });

  it('in der Statusphase lässt sich jeder Marker umlegen', () => {
    const draft = poolDraft(POOLS, 2, false);
    expect(canMove(draft, 'tactic', 'strategy')).toBe(true);
    expect(canMove(draft, 'strategy', 'loose')).toBe(true);
    const moved = moveToken(moveToken(draft, 'strategy', 'loose'), 'strategy', 'fleet');
    expect(moved.pools).toEqual({ tactic: 3, fleet: 4, strategy: 0 });
    expect(moved.loose).toBe(3);
  });

  it('aus leeren Feldern lässt sich nichts nehmen; die Summe bleibt gleich', () => {
    const draft = poolDraft({ tactic: 0, fleet: 1, strategy: 0 }, 0, false);
    expect(canMove(draft, 'loose', 'tactic')).toBe(false);
    expect(canMove(draft, 'tactic', 'fleet')).toBe(false);
    expect(canMove(draft, 'fleet', 'fleet')).toBe(false);
    for (const from of DRAFT_ZONES)
      for (const to of DRAFT_ZONES) expect(everything(moveToken(draft, from, to))).toBe(1);
  });
});
