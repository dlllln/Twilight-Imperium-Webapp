import {
  type GameState,
  type PlayerId,
  planetId,
  playerId,
  systemId,
  unitTypeId,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { coinsOf, legalFor, tradeCarryOf } from '../src/table/carry-rules.ts';
import type { PlanetTable } from '../src/table/planet-table.ts';
import { productionPlan } from '../src/table/production-draft.ts';
import {
  CRATE_PIECE,
  DOCK,
  GOODS_PIECE,
  isCoinRef,
  KASSE,
  parseTargetKey,
  pieceLabel,
  playerTarget,
  siteTarget,
  systemTarget,
  targetKey,
  targetLabel,
  yardPiece,
} from '../src/table/target-ref.ts';
import { type DropInput, dropIntent } from '../src/table/use-drop-router.ts';
import type { TradeMat } from '../src/table/use-trade-mat.ts';
import { pickAll, started } from './game-helpers.ts';

const BLUE = playerId('blue');
const GREEN = playerId('green');
const HOME = systemId('home');
const ALPHA = planetId('alpha');
const goods = (tradeGoods: number, commodities = 0) => ({ tradeGoods, commodities });

function inputOf(game: GameState, extra: Partial<DropInput> = {}): DropInput {
  const actor = game.actionPhase?.active as PlayerId;
  return { game, actor, choosing: false, specId: null, draft: null, ...extra };
}

const carry = (game: GameState, give = goods(0), own = goods(2, 1)) => ({
  game,
  actor: game.actionPhase?.active as PlayerId,
  choosing: false,
  draft: null,
  coins: null,
  trade: { partners: [BLUE], give, own },
});

describe('Werft und Handelsmatte: Stücke und Ziele', () => {
  it('Werft, Dock und Rohstoffkisten haben eigene Schlüssel und Namen', () => {
    const game = pickAll(started());
    for (const ref of [yardPiece('infantry'), DOCK, CRATE_PIECE])
      expect(parseTargetKey(targetKey(ref))).toEqual(ref);
    expect(targetKey(yardPiece('infantry'))).toBe('yard:infantry');
    expect(targetKey(DOCK)).toBe('slot:dock');
    expect(targetKey(CRATE_PIECE)).toBe('goods:commodities');
    expect(targetLabel(DOCK, game, 'de')).toBe('Dock der Werft');
    expect(targetLabel(yardPiece('infantry'), game, 'de')).toBe('Infanterie');
    expect(pieceLabel(CRATE_PIECE, game, 'de')).toBe('Rohstoff');
    expect(pieceLabel(GOODS_PIECE, game, 'de')).toBe('Handelsware');
  });

  it('Rohstoffkisten sind keine Münzen und gehen nicht in die Kasse', () => {
    const game = pickAll(started());
    expect(isCoinRef(CRATE_PIECE)).toBe(false);
    expect(isCoinRef(GOODS_PIECE)).toBe(true);
    expect(dropIntent(inputOf(game), CRATE_PIECE, KASSE)).toBeNull();
    expect(dropIntent(inputOf(game), GOODS_PIECE, KASSE)).toEqual({ kind: 'coins', delta: 1 });
    expect(dropIntent(inputOf(game), KASSE, CRATE_PIECE)).toBeNull();
  });

  it('Ware auf dem Bild eines Handelspartners kommt auf die Handelsmatte', () => {
    const game = pickAll(started());
    const input = inputOf(game, { partners: [BLUE] });
    expect(dropIntent(input, CRATE_PIECE, playerTarget(BLUE))).toEqual({
      kind: 'trade',
      partner: BLUE,
      good: 'commodities',
    });
    expect(dropIntent(input, GOODS_PIECE, playerTarget(BLUE))).toMatchObject({
      good: 'tradeGoods',
    });
    expect(dropIntent(input, GOODS_PIECE, playerTarget(GREEN))).toBeNull();
    expect(dropIntent(inputOf(game), GOODS_PIECE, playerTarget(BLUE))).toBeNull();
  });

  it('Ware darf auf die Bilder der Partner, solange von ihr etwas übrig ist', () => {
    const game = pickAll(started());
    const partner = targetKey(playerTarget(BLUE));
    expect(legalFor(carry(game), CRATE_PIECE)).toEqual(new Set([partner]));
    expect(legalFor(carry(game, goods(0, 1)), CRATE_PIECE).size).toBe(0);
    expect(legalFor(carry(game, goods(0, 1)), GOODS_PIECE)).toEqual(new Set([partner]));
    const paying = { ...carry(game), coins: { spent: 0, own: 2 } };
    expect(legalFor(paying, GOODS_PIECE)).toEqual(new Set([targetKey(KASSE), partner]));
    expect(legalFor({ ...carry(game), trade: null }, CRATE_PIECE).size).toBe(0);
  });

  it('Kasse und Handelsmatte teilen einen Münzvorrat', () => {
    const game = pickAll(started());
    const table = { tradeGoods: 1, ownTradeGoods: 2 } as PlanetTable;
    expect(coinsOf(table)).toEqual({ spent: 1, own: 2 });
    expect(coinsOf(table, 1)).toEqual({ spent: 1, own: 1 });
    const full = { ...carry(game, goods(1), goods(1, 1)), coins: coinsOf(table, 1) };
    expect(legalFor(full, GOODS_PIECE).size).toBe(0);
    expect(legalFor(full, KASSE)).toEqual(new Set([targetKey(GOODS_PIECE)]));
  });

  it('die Handelsmatte liefert dem Tragen Partner, Gegebenes und Vorrat', () => {
    const mat = {
      partners: [BLUE],
      draft: { give: goods(1) },
      own: goods(3),
    } as unknown as TradeMat;
    expect(tradeCarryOf(mat)).toEqual({ partners: [BLUE], give: goods(1), own: goods(3) });
    expect(tradeCarryOf(null)).toBeNull();
  });

  it('eine Einheit der Werft im Dock oder System wird bestellt, auf einem Planeten mit Ziel', () => {
    const game = pickAll(started());
    const input = inputOf(game, { specId: 'production', draft: productionPlan(HOME) });
    const infantry = yardPiece('infantry');
    const order = { kind: 'order', type: unitTypeId('infantry'), delta: 1 };
    expect(dropIntent(input, infantry, DOCK)).toEqual({
      kind: 'act',
      action: { ...order, planet: null },
    });
    expect(dropIntent(input, infantry, systemTarget(HOME))).toEqual({
      kind: 'act',
      action: { ...order, planet: null },
    });
    expect(dropIntent(input, infantry, siteTarget(ALPHA))).toEqual({
      kind: 'act',
      action: { ...order, planet: ALPHA },
    });
    expect(dropIntent(input, infantry, KASSE)).toBeNull();
  });
});
