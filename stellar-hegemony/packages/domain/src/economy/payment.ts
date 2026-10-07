import type { TileCatalog } from '../galaxy/tile-catalog.ts';
import type { GameState } from '../game/game-state.ts';
import { findPlayer } from '../game/game-state.ts';
import { Planet } from '../planet/planet.ts';
import type { PlanetDefinition } from '../planet/planet-definition.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import { andThen, combine, err, map, ok, type Result } from '../shared/result.ts';
import type { EconomyEvent } from './economy-events.ts';

/** Bezahlung durch Erschöpfen von Planeten und Ausgeben von Handelswaren. */
export interface Payment {
  readonly planets: readonly PlanetId[];
  readonly tradeGoods: number;
}

export type Currency = 'resources' | 'influence';

export const NO_PAYMENT: Payment = { planets: [], tradeGoods: 0 };

export function findPlanetDefinition(
  tiles: TileCatalog,
  id: PlanetId,
): PlanetDefinition | undefined {
  return tiles
    .all()
    .flatMap((tile) => tile.planets)
    .find((planet) => planet.id === id);
}

function planetValue(
  state: GameState,
  tiles: TileCatalog,
  player: PlayerId,
  id: PlanetId,
  currency: Currency,
) {
  const definition = findPlanetDefinition(tiles, id);
  const planetState = state.planets[id];
  if (definition === undefined || planetState === undefined) {
    return err(domainError('payment.unknownPlanet', `Unbekannter Planet: ${id}`, { planet: id }));
  }
  return andThen(Planet.of(definition, planetState), (planet) =>
    map(planet.exhaust(player), () =>
      currency === 'resources' ? planet.resources : planet.influence,
    ),
  );
}

function tradeGoodsCheck(
  state: GameState,
  player: PlayerId,
  payment: Payment,
): Result<number, DomainError> {
  const available = findPlayer(state, player)?.tradeGoods ?? 0;
  const valid =
    Number.isInteger(payment.tradeGoods) &&
    payment.tradeGoods >= 0 &&
    payment.tradeGoods <= available;
  return valid
    ? ok(payment.tradeGoods)
    : err(domainError('payment.tradeGoods', 'Nicht genug Handelswaren'));
}

/** RR 22.3/65.3: Handelswaren zählen wie Ressourcen oder Einfluss. Liefert den Gesamtwert. */
export function evaluatePayment(
  state: GameState,
  tiles: TileCatalog,
  player: PlayerId,
  payment: Payment,
  currency: Currency,
): Result<number, DomainError> {
  if (new Set(payment.planets).size !== payment.planets.length) {
    return err(domainError('payment.duplicatePlanet', 'Ein Planet wurde doppelt angegeben'));
  }
  const values = combine(
    payment.planets.map((id) => planetValue(state, tiles, player, id, currency)),
  );
  const goods = tradeGoodsCheck(state, player, payment);
  return andThen(values, (planetValues) =>
    map(goods, (tg) => planetValues.reduce((a, b) => a + b, tg)),
  );
}

/** Events, die eine gültige Bezahlung ausführen. */
export function paymentEvents(player: PlayerId, payment: Payment): readonly EconomyEvent[] {
  const events: EconomyEvent[] = [];
  if (payment.planets.length > 0)
    events.push({ type: 'PlanetsExhausted', player, planets: payment.planets });
  if (payment.tradeGoods > 0)
    events.push({ type: 'TradeGoodsSpent', player, amount: payment.tradeGoods });
  return events;
}
