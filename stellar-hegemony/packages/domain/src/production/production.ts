import { fleetLimitOf } from '../technology/technology-catalog.ts';
import { evaluatePayment, type Payment, paymentEvents } from '../economy/payment.ts';
import type { DecisionContext } from '../eventsourcing/command.ts';
import { StarSystem } from '../galaxy/star-system.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { PlanetId, PlayerId, SystemId, UnitTypeId } from '../shared/ids.ts';
import { andThen, combine, err, map, ok, type Result } from '../shared/result.ts';
import {
  type CanBeProduced,
  canBeProduced,
  isGroundForce,
  isShip,
} from '../unit/unit-capabilities.ts';
import type { UnitDefinition } from '../unit/unit-definition.ts';
import { UnitNumbering } from '../unit/unit-numbering.ts';
import type { UnitsProduced } from './production-events.ts';
import { isBlockaded, productionLimit, productionSites } from './production-queries.ts';

export interface ProductionOrder {
  readonly type: UnitTypeId;
  readonly count: number;
}

/** Was produziert wird, wie bezahlt wird und wohin neue Bodentruppen kommen. */
export interface ProductionRequest {
  readonly orders: readonly ProductionOrder[];
  readonly payment: Payment;
  readonly groundPlanet: PlanetId | null;
}

interface Resolved {
  readonly order: ProductionOrder;
  readonly definition: UnitDefinition & CanBeProduced;
}

interface ProductionInput {
  readonly state: GameState;
  readonly system: SystemId;
  readonly player: PlayerId;
  readonly request: ProductionRequest;
  readonly decision: DecisionContext;
}

function orderProblem(
  definition: UnitDefinition | undefined,
  order: ProductionOrder,
  technologies: readonly string[],
): string | null {
  if (definition === undefined || !canBeProduced(definition)) return 'production.notProducible';
  const tech = definition.requiresTechnology;
  if (tech !== undefined && !technologies.includes(tech)) return 'production.missingTechnology';
  if (!Number.isInteger(order.count) || order.count < 1) return 'production.invalidCount';
  return null;
}

function resolveOrder(
  input: ProductionInput,
  order: ProductionOrder,
): Result<Resolved, DomainError> {
  const definition = input.decision.content.units.find(order.type, input.player);
  const technologies = findPlayer(input.state, input.player)?.technologies ?? [];
  const problem = orderProblem(definition, order, technologies);
  if (problem !== null || definition === undefined || !canBeProduced(definition))
    return err(
      domainError(problem ?? 'production.notProducible', 'Bestellung ungültig', {
        type: order.type,
      }),
    );
  return ok({ order, definition });
}

/** RR 24.2: Paare (Jäger, Infanterie) kosten je angefangenem Paar einmal. */
export const productionCost = (resolved: readonly Resolved[]): number =>
  resolved.reduce(
    (sum, { order, definition }) =>
      sum + Math.ceil(order.count / definition.cost.unitsPerCost) * definition.cost.resources,
    0,
  );

const totalCount = (resolved: readonly Resolved[]) =>
  resolved.reduce((sum, r) => sum + r.order.count, 0);

export function ownedOnBoard(state: GameState, player: PlayerId, type: UnitTypeId): number {
  const units = [
    ...Object.values(state.systems).flatMap((system) => system.spaceUnits),
    ...Object.values(state.planets).flatMap((planet) => planet.units),
  ];
  return units.filter((unit) => unit.owner === player && unit.type === type).length;
}

/** RR 24.5: Mehr Einheiten, als die Vorratsgrenze erlaubt, gibt es nicht. */
const withinSupply = (input: ProductionInput, resolved: readonly Resolved[]): boolean =>
  resolved.every(({ order, definition }) => {
    const limit = definition.componentLimit;
    return (
      limit === 'unlimited' ||
      ownedOnBoard(input.state, input.player, order.type) + order.count <= limit
    );
  });

function groundPlacement(input: ProductionInput, resolved: readonly Resolved[]): Check {
  const needsPlanet = resolved.some(({ definition }) => isGroundForce(definition));
  const { groundPlanet } = input.request;
  const sites = productionSites(input.state, input.system, input.player, input.decision.content);
  const valid =
    groundPlanet !== null &&
    sites.some((site) => site.planet === groundPlanet) &&
    input.state.planets[groundPlanet]?.controller === input.player;
  return guard(
    !needsPlanet || valid,
    'production.groundPlanet',
    'Bodentruppen brauchen einen eigenen Planeten mit Produktion',
  );
}

function capacityChecks(input: ProductionInput, resolved: readonly Resolved[]): Check {
  const { state, system, player, decision } = input;
  const sites = productionSites(state, system, player, decision.content);
  const limit = productionLimit(sites);
  const ships = resolved.some(({ definition }) => isShip(definition));
  const blocked = ships && isBlockaded(state, system, player, decision.content.units);
  const supplied = withinSupply(input, resolved);
  return firstFailure([
    guard(sites.length > 0, 'production.noProductionUnit', 'Keine Produktionseinheit'),
    guard(totalCount(resolved) <= limit, 'production.limit', 'Zu viele Einheiten', { limit }),
    guard(!blocked, 'production.blockaded', 'Blockiert: keine Schiffe'),
    guard(supplied, 'production.componentLimit', 'Keine Einheiten mehr im Vorrat'),
    groundPlacement(input, resolved),
  ]);
}

function payFor(
  input: ProductionInput,
  resolved: readonly Resolved[],
): Result<readonly GameEvent[], DomainError> {
  const { state, player, request, decision } = input;
  const cost = productionCost(resolved);
  return andThen(
    evaluatePayment(state, decision.content.tiles, player, request.payment, 'resources'),
    (value) =>
      value < cost
        ? err(domainError('production.cost', 'Zu wenig Ressourcen', { cost }))
        : ok(paymentEvents(player, request.payment)),
  );
}

function producedEvent(input: ProductionInput, resolved: readonly Resolved[]): UnitsProduced {
  const { state, system, player, request } = input;
  const numbering = new UnitNumbering(state.nextUnitNumber);
  const ground = resolved.filter(({ definition }) => isGroundForce(definition)).map((r) => r.order);
  const space = resolved.filter(({ definition }) => !isGroundForce(definition)).map((r) => r.order);
  return {
    type: 'UnitsProduced',
    player,
    system,
    space: numbering.create(player, space),
    planet: ground.length > 0 ? request.groundPlanet : null,
    ground: numbering.create(player, ground),
  };
}

/** RR 28, RR 43: Nach der Produktion gelten Flottenlimit und Kapazität. */
function limitsAfter(input: ProductionInput, events: readonly GameEvent[]): Check {
  const after = events.reduce(evolveGame, input.state);
  const systemState = after.systems[input.system];
  if (systemState === undefined)
    return err(domainError('tactical.unknownSystem', 'Unbekanntes System'));
  const planets = systemState.planetIds.flatMap((id) => after.planets[id] ?? []);
  const fleet = fleetLimitOf(after, input.player, input.decision.content);
  return andThen(StarSystem.inspect(systemState, planets, input.decision.content.units), (star) =>
    firstFailure([
      guard(
        !star.exceedsFleetLimit(input.player, fleet),
        'production.fleetLimit',
        'Flottenlimit überschritten',
      ),
      guard(!star.exceedsCapacity(input.player), 'production.capacity', 'Zu wenig Kapazität'),
    ]),
  );
}

/**
 * Pure Fabrication für alle Produktionswege (Taktikaktion, Kriegsführung sekundär):
 * prüft Bestellung, Bezahlung und Grenzen und liefert die Events.
 */
export function productionEvents(
  input: ProductionInput,
): Result<readonly GameEvent[], DomainError> {
  const resolved = combine(input.request.orders.map((order) => resolveOrder(input, order)));
  return andThen(resolved, (orders) =>
    andThen(capacityChecks(input, orders), () =>
      andThen(payFor(input, orders), (payment) => {
        const events: readonly GameEvent[] = [...payment, producedEvent(input, orders)];
        return map(limitsAfter(input, events), () => events);
      }),
    ),
  );
}
