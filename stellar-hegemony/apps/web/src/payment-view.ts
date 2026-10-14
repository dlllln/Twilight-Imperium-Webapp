import {
  type ContentPort,
  type Currency,
  evaluatePayment,
  currentPlanetDefinition,
  type GameState,
  type Payment,
  type PlanetId,
  type PlayerId,
} from '@stellar/domain';

/** Eigene, bereite Planeten mit ihrem Wert in der gesuchten Währung. */
export function payablePlanets(
  game: GameState,
  player: PlayerId,
  content: ContentPort,
  currency: Currency,
): readonly { readonly planet: PlanetId; readonly value: number }[] {
  return Object.values(game.planets)
    .filter((planet) => planet.controller === player && !planet.exhausted)
    .map((planet) => ({
      planet: planet.id,
      value: currentPlanetDefinition(game, content.tiles, planet.id)?.[currency] ?? 0,
    }));
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
