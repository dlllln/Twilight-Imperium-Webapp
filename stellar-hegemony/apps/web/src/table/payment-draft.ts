import {
  type Currency,
  findPlayer,
  type GameState,
  type Payment,
  type PlanetId,
  type PlayerId,
  spendablePlanets,
} from '@stellar/domain';
import { paymentValue } from '../payment-view.ts';
import { content } from '../store.ts';

/*
 * Entwurf einer Bezahlung (reine Funktionen): vorgemerkte Planeten und Münzen in der Kasse.
 * Formular und Tisch schreiben denselben Entwurf; den Wert rechnet allein die Domain.
 */

export interface PaymentPlan {
  readonly kind: 'payment';
  readonly currency: Currency;
  readonly planets: readonly PlanetId[];
  readonly tradeGoods: number;
}

export const paymentPlan = (currency: Currency): PaymentPlan => ({
  kind: 'payment',
  currency,
  planets: [],
  tradeGoods: 0,
});

/** Freigeben geht immer; vormerken nur, was gerade bezahlbar ist. */
export function togglePlanet(
  plan: PaymentPlan,
  planet: PlanetId,
  spendable: readonly PlanetId[],
): PaymentPlan {
  if (plan.planets.includes(planet))
    return { ...plan, planets: plan.planets.filter((id) => id !== planet) };
  return spendable.includes(planet) ? { ...plan, planets: [...plan.planets, planet] } : plan;
}

/** Münzen in die Kasse legen oder herausnehmen, zwischen null und dem eigenen Vorrat. */
export function addCoins(plan: PaymentPlan, delta: number, own: number): PaymentPlan {
  const tradeGoods = Math.min(Math.max(0, own), Math.max(0, plan.tradeGoods + delta));
  return tradeGoods === plan.tradeGoods ? plan : { ...plan, tradeGoods };
}

/** Dieselbe Währung behält den Entwurf, eine andere beginnt neu. */
export const inCurrency = (plan: PaymentPlan, currency: Currency): PaymentPlan =>
  plan.currency === currency ? plan : paymentPlan(currency);

export const paymentOf = (plan: PaymentPlan): Payment => ({
  planets: plan.planets,
  tradeGoods: plan.tradeGoods,
});

/** Wert laut Domain; eine ungültige Bezahlung zählt 0. */
export const paymentValueOf = (game: GameState, player: PlayerId, plan: PaymentPlan): number =>
  paymentValue(game, player, paymentOf(plan), content, plan.currency);

/** Bezahlbare Planeten laut Domain, nur die Kennungen. */
export const spendableIds = (
  game: GameState,
  player: PlayerId,
  currency: Currency,
): readonly PlanetId[] =>
  spendablePlanets(game, content.tiles, player, currency).map((entry) => entry.planet);

export const ownTradeGoods = (game: GameState, player: PlayerId): number =>
  findPlayer(game, player)?.tradeGoods ?? 0;
