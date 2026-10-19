import {
  type ContentPort,
  type Currency,
  evaluatePayment,
  type GameState,
  type Payment,
  type PlayerId,
  type SpendablePlanet,
  spendablePlanets,
} from '@stellar/domain';

/** Eigene, bereite Planeten mit ihrem Wert in der gesuchten Währung. */
export function payablePlanets(
  game: GameState,
  player: PlayerId,
  content: ContentPort,
  currency: Currency,
): readonly SpendablePlanet[] {
  return spendablePlanets(game, content.tiles, player, currency);
}

/** Wert einer Bezahlung laut Domain; eine ungültige Bezahlung zählt 0. */
export function paymentValue(
  game: GameState,
  player: PlayerId,
  payment: Payment,
  content: ContentPort,
  currency: Currency,
): number {
  const value = evaluatePayment(game, content.tiles, player, payment, currency);
  return value.ok ? value.value : 0;
}
