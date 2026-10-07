import type { PlayerId } from '../shared/ids.ts';

/** Was in einer Transaktion den Besitzer wechselt (RR 82.2, ohne Vertragskarten). */
export interface Goods {
  readonly tradeGoods: number;
  readonly commodities: number;
}

export const NO_GOODS: Goods = { tradeGoods: 0, commodities: 0 };

/** Offenes Angebot des aktiven Spielers an einen Nachbarn; erst die Zustimmung vollzieht es. */
export interface PendingTransaction {
  readonly from: PlayerId;
  readonly to: PlayerId;
  readonly offer: Goods;
  readonly request: Goods;
}

export const isValidGoods = (goods: Goods): boolean =>
  [goods.tradeGoods, goods.commodities].every((n) => Number.isInteger(n) && n >= 0);
