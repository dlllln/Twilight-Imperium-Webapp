import { NO_GOODS, playerId } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import {
  askGoods,
  canPropose,
  choosePartner,
  fitted,
  giveGoods,
  proposalOf,
  tradeDraft,
} from '../src/table/trade-draft.ts';
import { draftFor, tradeKey } from '../src/table/trade-store.ts';

const RED = playerId('red');
const BLUE = playerId('blue');
const GREEN = playerId('green');
const goods = (tradeGoods: number, commodities = 0) => ({ tradeGoods, commodities });

describe('Entwurf der Handelsmatte', () => {
  it('ohne Partner und ohne Waren gibt es kein Angebot', () => {
    const draft = tradeDraft();
    expect(draft).toEqual({ partner: null, give: NO_GOODS, ask: NO_GOODS });
    expect(canPropose(draft)).toBe(false);
    expect(canPropose(choosePartner(draft, BLUE))).toBe(false);
    expect(proposalOf(choosePartner(draft, BLUE), RED)).toBeNull();
  });

  it('geben bleibt im eigenen Vorrat, erbitten im Vorrat des Partners', () => {
    const own = goods(1, 2);
    const given = giveGoods(giveGoods(tradeDraft(), 'tradeGoods', 1, own), 'tradeGoods', 1, own);
    expect(given.give).toEqual(goods(1));
    expect(giveGoods(given, 'tradeGoods', -1, own).give).toEqual(NO_GOODS);
    expect(askGoods(given, 'commodities', 1, goods(0, 3))).toBe(given);
    const asked = askGoods(choosePartner(given, BLUE), 'commodities', 1, goods(0, 0));
    expect(asked.ask).toEqual(NO_GOODS);
  });

  it('ein anderer Partner setzt die Bitte zurück, das Gegebene bleibt', () => {
    const start = choosePartner(giveGoods(tradeDraft(), 'commodities', 1, goods(0, 2)), BLUE);
    const asked = askGoods(start, 'tradeGoods', 1, goods(4));
    expect(asked.ask).toEqual(goods(1));
    expect(choosePartner(asked, BLUE)).toBe(asked);
    const switched = choosePartner(asked, GREEN);
    expect(switched).toEqual({ partner: GREEN, give: goods(0, 1), ask: NO_GOODS });
  });

  it('nur eine Seite mit Ware genügt für ein Angebot an einen Partner', () => {
    const asked = askGoods(choosePartner(tradeDraft(), BLUE), 'tradeGoods', 1, goods(2));
    expect(canPropose(asked)).toBe(true);
    expect(proposalOf(asked, RED)).toEqual({
      type: 'ProposeTransaction',
      issuedBy: RED,
      partner: BLUE,
      offer: NO_GOODS,
      request: goods(1),
    });
  });

  it('nach einem neuen Stand passt der Entwurf in Partner und Vorräte', () => {
    const draft = { partner: BLUE, give: goods(3, 1), ask: goods(2) };
    expect(fitted(draft, [BLUE], goods(1, 1), goods(1))).toEqual({
      partner: BLUE,
      give: goods(1, 1),
      ask: goods(1),
    });
    expect(fitted(draft, [GREEN], goods(5, 5), goods(5))).toEqual({
      partner: null,
      give: goods(3, 1),
      ask: NO_GOODS,
    });
  });

  it('ein neuer Spielstand oder ein anderer Spieler beginnt mit leerer Matte', () => {
    const draft = choosePartner(tradeDraft(), BLUE);
    const stored = { key: tradeKey(4, RED), draft };
    expect(draftFor(stored, tradeKey(4, RED))).toBe(draft);
    expect(draftFor(stored, tradeKey(5, RED))).toEqual(tradeDraft());
    expect(draftFor(stored, tradeKey(4, BLUE))).toEqual(tradeDraft());
  });
});
