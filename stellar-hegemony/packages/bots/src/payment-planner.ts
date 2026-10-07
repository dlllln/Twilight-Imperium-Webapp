import {
  type Currency,
  NO_PAYMENT,
  ownPlanets,
  type Payment,
  type PlanetId,
} from '@stellar/domain';
import { type BotView, contentOf, me } from './bot-view.ts';

export interface ReadyPlanet {
  readonly id: PlanetId;
  readonly value: number;
}

/** Eigene, bereite Planeten mit ihrem Wert in der Währung, wertvollste zuerst. */
export function readyPlanets(view: BotView, currency: Currency): readonly ReadyPlanet[] {
  return ownPlanets(view.state, view.player, contentOf(view))
    .filter((planet) => !planet.state.exhausted)
    .map((planet) => ({ id: planet.state.id, value: planet.definition[currency] }))
    .sort((a, b) => b.value - a.value);
}

/** Wert, den der Spieler höchstens aufbringen kann (bereite Planeten und Handelswaren). */
export const budget = (view: BotView, currency: Currency): number =>
  readyPlanets(view, currency).reduce((sum, planet) => sum + planet.value, me(view).tradeGoods);

/**
 * Gierige Bezahlung: Planeten nach Wert, bis der Betrag erreicht ist, den Rest mit
 * Handelswaren. `null`, wenn es nicht reicht.
 */
export function planPayment(view: BotView, currency: Currency, amount: number): Payment | null {
  if (amount <= 0) return NO_PAYMENT;
  const planets: PlanetId[] = [];
  let paid = 0;
  for (const planet of readyPlanets(view, currency)) {
    if (paid >= amount) break;
    planets.push(planet.id);
    paid += planet.value;
  }
  const tradeGoods = Math.max(0, amount - paid);
  return tradeGoods <= me(view).tradeGoods ? { planets, tradeGoods } : null;
}
