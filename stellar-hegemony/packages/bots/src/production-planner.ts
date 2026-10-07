import {
  canBeProduced,
  type GameCommand,
  isGroundForce,
  isShip,
  ownedOnBoard,
  type ProductionOrder,
  productionQuote,
  type ProductionRequest,
  producibleUnits,
  type SystemId,
  type UnitDefinition,
} from '@stellar/domain';
import { type BotView, contentOf, issued } from './bot-view.ts';
import { budget, planPayment } from './payment-planner.ts';

/** Kampfwert je Ressource: danach wählen Bots ihre Schiffe. */
function efficiency(unit: UnitDefinition, dieSides: number): number {
  if (!canBeProduced(unit) || unit.combat === undefined) return 0;
  const hits = (unit.combat.dice * (dieSides + 1 - unit.combat.hitOn)) / dieSides;
  return (hits * unit.cost.unitsPerCost) / Math.max(1, unit.cost.resources);
}

/** Erst Bodentruppen für weitere Eroberungen, dann Schiffe nach Kampfwert je Ressource. */
function wishList(view: BotView): readonly UnitDefinition[] {
  const { dieSides } = view.state.config.rules;
  const units = producibleUnits(view.state, view.player, contentOf(view).units);
  const ground = units.filter(isGroundForce);
  const ships = units
    .filter((unit) => isShip(unit) && !unit.isFighter)
    .sort((a, b) => efficiency(b, dieSides) - efficiency(a, dieSides));
  return [...ground, ...ships];
}

/** Erhöht die Bestellung eines Typs oder legt sie an. */
function add(orders: readonly ProductionOrder[], unit: UnitDefinition): readonly ProductionOrder[] {
  const count = canBeProduced(unit) ? unit.cost.unitsPerCost : 1;
  const existing = orders.find((order) => order.type === unit.id);
  if (existing === undefined) return [...orders, { type: unit.id, count }];
  return orders.map((order) =>
    order === existing ? { ...order, count: order.count + count } : order,
  );
}

/** RR 24.5: nicht mehr Einheiten, als der Vorrat hergibt. */
function inSupply(
  view: BotView,
  orders: readonly ProductionOrder[],
  unit: UnitDefinition,
): boolean {
  const ordered = orders.find((order) => order.type === unit.id)?.count ?? 0;
  const limit = unit.componentLimit;
  return limit === 'unlimited' || ownedOnBoard(view.state, view.player, unit.id) + ordered <= limit;
}

/** Ob die Bestellung in Produktionslimit und Budget passt (RR 62, RR 24). */
function fits(view: BotView, system: SystemId, orders: readonly ProductionOrder[]): boolean {
  const quote = productionQuote(view.state, system, view.player, orders, contentOf(view));
  return quote.count <= quote.limit && quote.cost <= budget(view, 'resources');
}

/** Ein Durchgang über die Wunschliste: jede Einheit einmal, solange sie passt. */
function extend(view: BotView, system: SystemId, orders: readonly ProductionOrder[]) {
  return wishList(view).reduce((current, unit) => {
    const next = add(current, unit);
    return fits(view, system, next) && inSupply(view, next, unit) ? next : current;
  }, orders);
}

const MAX_ROUNDS = 10;

/** Gierige Bestellung in Runden, bis nichts mehr dazukommt. */
export function planOrders(view: BotView, system: SystemId): readonly ProductionOrder[] {
  let orders: readonly ProductionOrder[] = [];
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const next = extend(view, system, orders);
    if (next === orders) break;
    orders = next;
  }
  return orders;
}

function request(view: BotView, system: SystemId, orders: readonly ProductionOrder[]) {
  const quote = productionQuote(view.state, system, view.player, orders, contentOf(view));
  const payment = planPayment(view, 'resources', quote.cost);
  if (payment === null || orders.length === 0) return [];
  return [{ orders, payment, groundPlanet: quote.groundPlanets[0] ?? null }];
}

/** Bestellungen in absteigender Größe: die volle, nur Bodentruppen, nur die erste Einheit. */
export function productionRequests(view: BotView, system: SystemId): readonly ProductionRequest[] {
  const orders = planOrders(view, system);
  const ground = orders.filter((order) => {
    const unit = contentOf(view).units.find(order.type, view.player);
    return unit !== undefined && isGroundForce(unit);
  });
  return [orders, ground, orders.slice(0, 1)].flatMap((variant) => request(view, system, variant));
}

export function productionCommands(view: BotView): readonly GameCommand[] {
  const system = view.state.actionPhase?.tactical?.system;
  if (system === undefined) return [];
  const requests = productionRequests(view, system).map((plan) => ({
    type: 'ProduceUnits' as const,
    ...issued(view),
    ...plan,
  }));
  const none = { orders: [], payment: { planets: [], tradeGoods: 0 }, groundPlanet: null };
  return [...requests, { type: 'ProduceUnits', ...issued(view), ...none }];
}
