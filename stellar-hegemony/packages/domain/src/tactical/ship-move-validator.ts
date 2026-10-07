import { areSystemsAdjacent } from '../galaxy/adjacency.ts';
import type { SystemState } from '../galaxy/system-state.ts';
import type { GameState } from '../game/game-state.ts';
import type { RuleNumbers } from '../game/rule-numbers.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { PlayerId, SystemId, UnitId } from '../shared/ids.ts';
import { andThen, combine, err, map, ok, type Result } from '../shared/result.ts';
import { canMove, isShip, occupiesCapacity } from '../unit/unit-capabilities.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { UnitDefinition } from '../unit/unit-definition.ts';
import { locateUnit, type UnitLocation } from './board-queries.ts';
import { baseMove, canEnter, isGravityRift } from './route-rules.ts';
import type { CargoPickup, ShipMovement } from './tactical-events.ts';

/** Wunsch des Spielers für ein Schiff: Route ins aktive System und mitgenommene Einheiten. */
export interface ShipMoveOrder {
  readonly ship: UnitId;
  readonly path: readonly SystemId[];
  readonly cargo: readonly UnitId[];
}

export interface MoveContext {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly active: SystemId;
  readonly catalog: UnitCatalog;
  readonly rules: RuleNumbers;
}

export interface ValidatedMove extends ShipMovement {
  /** Wie viele Gravitationsstrudel das Schiff verlässt (je einer ein Wurf). */
  readonly riftExits: number;
}

interface Route {
  readonly origin: SystemState;
  readonly steps: readonly SystemState[];
  readonly ship: UnitDefinition;
}

const fail = (code: string, message: string): Result<never, DomainError> =>
  err(domainError(code, message));

const hasToken = (context: MoveContext, system: SystemState): boolean =>
  system.commandTokens.includes(context.player);

function resolveShip(context: MoveContext, order: ShipMoveOrder) {
  const location = locateUnit(context.state, order.ship);
  if (location?.planet !== null) return fail('move.unknownShip', 'Schiff nicht gefunden');
  const definition = context.catalog.find(location.unit.type, location.unit.owner);
  if (definition === undefined) return fail('unit.unknownType', 'Unbekannter Einheitentyp');
  return ok({ location, definition });
}

/** RR 15.5: eigenes Schiff mit Bewegungswert, Start nicht in einem System mit eigenem Marker. */
function shipChecks(
  context: MoveContext,
  location: UnitLocation,
  origin: SystemState,
  ship: UnitDefinition,
): Check {
  return firstFailure([
    guard(location.unit.owner === context.player, 'move.notYourShip', 'Nicht dein Schiff'),
    guard(
      isShip(ship) && canMove(ship),
      'move.cannotMove',
      'Diese Einheit kann sich nicht bewegen',
    ),
    guard(
      origin.id === context.active || !hasToken(context, origin),
      'move.originHasToken',
      'Schiffe in Systemen mit eigenem Kommandomarker bleiben stehen',
    ),
  ]);
}

function resolveSteps(context: MoveContext, path: readonly SystemId[]) {
  const steps = path.map((id) => context.state.systems[id]);
  if (steps.some((step) => step === undefined))
    return fail('move.unknownSystem', 'Unbekanntes System');
  if (path.at(-1) !== context.active)
    return fail('move.mustEndInActive', 'Die Route endet im aktiven System');
  return ok(steps.filter((step): step is SystemState => step !== undefined));
}

/** Gravitationsstrudel, die das Schiff verlässt: Startsystem und Zwischenstationen. */
const riftExitsOf = (route: Route): number =>
  [route.origin, ...route.steps.slice(0, -1)].filter(isGravityRift).length;

function routeChecks(context: MoveContext, route: Route): Check {
  const { origin, steps, ship } = route;
  const budget =
    baseMove(ship, origin, context.rules) + riftExitsOf(route) * context.rules.gravityRiftMoveBonus;
  const adjacent = steps.every((step, index) =>
    areSystemsAdjacent(steps[index - 1] ?? origin, step),
  );
  const enterable = steps.every((step, index) =>
    canEnter(step, context.player, index === steps.length - 1, context.catalog),
  );
  return firstFailure([
    guard(adjacent, 'move.notAdjacent', 'Die Route führt nicht durch angrenzende Systeme'),
    guard(enterable, 'move.blocked', 'Ein System auf der Route ist gesperrt'),
    guard(steps.length <= budget, 'move.tooFar', 'Der Bewegungswert reicht nicht'),
  ]);
}

/** RR 83.1/83.3: Mitnahme aus Start-, Durchflug- und aktivem System, nicht bei eigenem Marker. */
function pickupSystems(context: MoveContext, route: Route): ReadonlySet<SystemId> {
  const passed = [route.origin, ...route.steps].filter(
    (system) => system.id === context.active || !hasToken(context, system),
  );
  return new Set(passed.map((system) => system.id));
}

function cargoChecks(
  context: MoveContext,
  reachable: ReadonlySet<SystemId>,
  location: UnitLocation,
  cargo: UnitDefinition,
): Check {
  return firstFailure([
    guard(location.unit.owner === context.player, 'move.cargoNotYours', 'Fremde Fracht'),
    guard(occupiesCapacity(cargo), 'move.cargoNotTransportable', 'Nur Jäger und Bodentruppen'),
    guard(reachable.has(location.system), 'move.cargoOutOfReach', 'Fracht nicht auf der Route'),
  ]);
}

function cargoPickup(
  context: MoveContext,
  reachable: ReadonlySet<SystemId>,
  id: UnitId,
): Result<CargoPickup, DomainError> {
  const location = locateUnit(context.state, id);
  const cargo =
    location === undefined
      ? undefined
      : context.catalog.find(location.unit.type, location.unit.owner);
  if (location === undefined || cargo === undefined)
    return fail('move.cargoUnknown', 'Fracht nicht gefunden');
  return map(cargoChecks(context, reachable, location, cargo), () => ({
    unit: id,
    system: location.system,
    planet: location.planet,
  }));
}

function cargoOf(context: MoveContext, route: Route, order: ShipMoveOrder) {
  if (order.cargo.length > (route.ship.capacity ?? 0))
    return fail('move.overCapacity', 'Mehr Fracht als Kapazität');
  const reachable = pickupSystems(context, route);
  return combine(order.cargo.map((id) => cargoPickup(context, reachable, id)));
}

function validateRoute(
  context: MoveContext,
  order: ShipMoveOrder,
  origin: SystemState,
  ship: UnitDefinition,
): Result<ValidatedMove, DomainError> {
  return andThen(resolveSteps(context, order.path), (steps) => {
    const route = { origin, steps, ship };
    const valid = routeChecks(context, route);
    if (!valid.ok) return valid;
    return map(cargoOf(context, route, order), (cargo) => ({
      ship: order.ship,
      from: origin.id,
      path: order.path,
      cargo,
      riftExits: riftExitsOf(route),
    }));
  });
}

/** Prüft die Bewegung eines einzelnen Schiffs (RR 15, RR 83). */
export function validateShipMove(
  context: MoveContext,
  order: ShipMoveOrder,
): Result<ValidatedMove, DomainError> {
  return andThen(resolveShip(context, order), ({ location, definition }) => {
    const origin = context.state.systems[location.system] as SystemState;
    const checked = shipChecks(context, location, origin, definition);
    return checked.ok ? validateRoute(context, order, origin, definition) : checked;
  });
}
