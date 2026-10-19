import { planetId } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import {
  addCoins,
  inCurrency,
  paymentOf,
  paymentPlan,
  togglePlanet,
} from '../src/table/payment-draft.ts';

const ALPHA = planetId('alpha');
const BETA = planetId('beta');
const SPENDABLE = [ALPHA, BETA];

describe('Entwurf einer Bezahlung', () => {
  it('ein Planet wird vorgemerkt und wieder freigegeben', () => {
    const marked = togglePlanet(paymentPlan('resources'), ALPHA, SPENDABLE);
    expect(marked.planets).toEqual([ALPHA]);
    expect(togglePlanet(marked, BETA, SPENDABLE).planets).toEqual([ALPHA, BETA]);
    expect(togglePlanet(marked, ALPHA, SPENDABLE).planets).toEqual([]);
    expect(paymentOf(marked)).toEqual({ planets: [ALPHA], tradeGoods: 0 });
  });

  it('nur bezahlbare Planeten lassen sich vormerken', () => {
    const plan = paymentPlan('influence');
    expect(togglePlanet(plan, ALPHA, [BETA])).toBe(plan);
    const marked = togglePlanet(plan, ALPHA, SPENDABLE);
    // Freigeben geht auch, wenn der Planet nicht mehr bezahlbar ist.
    expect(togglePlanet(marked, ALPHA, []).planets).toEqual([]);
  });

  it('Handelswaren bleiben zwischen null und dem eigenen Vorrat', () => {
    const plan = paymentPlan('resources');
    expect(addCoins(plan, -1, 3)).toBe(plan);
    const two = addCoins(addCoins(plan, 1, 2), 1, 2);
    expect(two.tradeGoods).toBe(2);
    expect(addCoins(two, 1, 2)).toBe(two);
    expect(addCoins(two, -1, 2).tradeGoods).toBe(1);
    expect(addCoins(two, 0, 1).tradeGoods).toBe(1);
  });

  it('ein Wechsel der Währung beginnt eine neue Bezahlung', () => {
    const plan = addCoins(togglePlanet(paymentPlan('resources'), ALPHA, SPENDABLE), 1, 3);
    expect(inCurrency(plan, 'resources')).toBe(plan);
    expect(inCurrency(plan, 'influence')).toEqual({
      kind: 'payment',
      currency: 'influence',
      planets: [],
      tradeGoods: 0,
    });
  });
});
