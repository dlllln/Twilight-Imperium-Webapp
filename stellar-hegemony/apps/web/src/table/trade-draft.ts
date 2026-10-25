import { type GameCommand, type Goods, NO_GOODS, type PlayerId } from '@stellar/domain';
import type { GoodKind } from './target-ref.ts';

/*
 * Entwurf der Handelsmatte (reine Funktionen): der Partner, was man gibt und was man erbittet.
 * Wechselt der Partner, beginnt die Bitte von vorn (sie richtet sich nach seinem Vorrat); beide
 * Seiten bleiben im Vorrat ihres Besitzers. Ein leeres Angebot wird nicht gemacht.
 */

export interface TradeDraft {
  readonly partner: PlayerId | null;
  readonly give: Goods;
  readonly ask: Goods;
}

export const tradeDraft = (): TradeDraft => ({ partner: null, give: NO_GOODS, ask: NO_GOODS });

const clamp = (value: number, most: number): number =>
  Math.min(Math.max(0, most), Math.max(0, value));

const clampedTo = (goods: Goods, stock: Goods): Goods => ({
  tradeGoods: clamp(goods.tradeGoods, stock.tradeGoods),
  commodities: clamp(goods.commodities, stock.commodities),
});

const stepped = (goods: Goods, good: GoodKind, delta: number, stock: Goods): Goods =>
  clampedTo({ ...goods, [good]: goods[good] + delta }, stock);

/** Einen Partner wählen; ein anderer Partner setzt die Bitte zurück. */
export const choosePartner = (draft: TradeDraft, partner: PlayerId): TradeDraft =>
  draft.partner === partner ? draft : { ...draft, partner, ask: NO_GOODS };

/** Etwas mehr oder weniger geben, höchstens den eigenen Vorrat. */
export const giveGoods = (draft: TradeDraft, good: GoodKind, delta: number, own: Goods) => ({
  ...draft,
  give: stepped(draft.give, good, delta, own),
});

/** Etwas mehr oder weniger erbitten, höchstens den Vorrat des Partners; ohne Partner nichts. */
export const askGoods = (
  draft: TradeDraft,
  good: GoodKind,
  delta: number,
  theirs: Goods | null,
): TradeDraft =>
  draft.partner === null || theirs === null
    ? draft
    : { ...draft, ask: stepped(draft.ask, good, delta, theirs) };

/**
 * Der Entwurf zum aktuellen Stand: ein Partner, mit dem nicht mehr gehandelt werden darf, fällt
 * weg (samt Bitte); beide Seiten passen in die Vorräte.
 */
export function fitted(
  draft: TradeDraft,
  partners: readonly PlayerId[],
  own: Goods,
  theirs: Goods | null,
): TradeDraft {
  const partner = draft.partner !== null && partners.includes(draft.partner) ? draft.partner : null;
  const ask = partner === null || theirs === null ? NO_GOODS : clampedTo(draft.ask, theirs);
  return { partner, give: clampedTo(draft.give, own), ask };
}

const isEmpty = (goods: Goods): boolean => goods.tradeGoods === 0 && goods.commodities === 0;

/** Ein Angebot braucht einen Partner und mindestens eine Ware auf einer Seite. */
export const canPropose = (draft: TradeDraft): boolean =>
  draft.partner !== null && !(isEmpty(draft.give) && isEmpty(draft.ask));

/** Das Angebot als Befehl; `null`, solange es keines ist. */
export function proposalOf(draft: TradeDraft, player: PlayerId): GameCommand | null {
  if (draft.partner === null || !canPropose(draft)) return null;
  const { partner, give: offer, ask: request } = draft;
  return { type: 'ProposeTransaction', issuedBy: player, partner, offer, request };
}
