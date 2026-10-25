import {
  isGroundForce,
  NO_PAYMENT,
  type PlanetId,
  type ProductionChoice,
  type ProductionOrder,
  type ProductionRequest,
  type SystemId,
  type UnitTypeId,
  unitTypeId,
} from '@stellar/domain';
import { paymentOf, paymentPlan } from './payment-draft.ts';
import type { ProductionPlan } from './spec-types.ts';

/*
 * Entwurf der Werft (reine Funktionen): bestellte Einheiten je Art, der Planet neuer
 * Bodentruppen und die Bezahlung. Ob eine weitere Einheit passt, sagt die Domain
 * (`productionChoices`); hier wird nur gezählt.
 */

export const productionPlan = (system: SystemId | null): ProductionPlan => ({
  kind: 'production',
  system,
  orders: {},
  groundPlanet: null,
  payment: paymentPlan('resources'),
});

/** Die Bestellung, wie `ProduceUnits` sie erwartet: nur Arten mit mindestens einer Einheit. */
export const ordersOf = (plan: ProductionPlan): readonly ProductionOrder[] =>
  Object.entries(plan.orders)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type: unitTypeId(type), count }));

export const orderedCount = (plan: ProductionPlan): number =>
  Object.values(plan.orders).reduce((sum, count) => sum + count, 0);

function withCount(
  orders: Readonly<Record<string, number>>,
  type: UnitTypeId,
  count: number,
): Readonly<Record<string, number>> {
  const rest = Object.fromEntries(Object.entries(orders).filter(([entry]) => entry !== type));
  return count > 0 ? { ...rest, [type]: count } : rest;
}

/** Ob die Änderung erlaubt ist: hinzufügen nur, wenn die Domain Platz meldet. */
function allowed(plan: ProductionPlan, choice: ProductionChoice, delta: 1 | -1): boolean {
  return delta === 1 ? choice.canAdd : (plan.orders[choice.unit.id] ?? 0) > 0;
}

/**
 * Eine Einheit bestellen oder zurücknehmen. Ein Planet beim Bestellen wird der Planet neuer
 * Bodentruppen; ohne Bestellung beginnt die Bezahlung von vorn.
 */
export function order(
  plan: ProductionPlan,
  choices: readonly ProductionChoice[],
  type: UnitTypeId,
  delta: 1 | -1,
  planet: PlanetId | null = null,
): ProductionPlan {
  const choice = choices.find((entry) => entry.unit.id === type);
  if (choice === undefined || !allowed(plan, choice, delta)) return plan;
  const orders = withCount(plan.orders, type, (plan.orders[type] ?? 0) + delta);
  const groundPlanet = delta === 1 && planet !== null ? planet : plan.groundPlanet;
  const empty = Object.keys(orders).length === 0;
  return {
    ...plan,
    orders,
    groundPlanet,
    payment: empty ? paymentPlan('resources') : plan.payment,
  };
}

/** Den Planeten neuer Bodentruppen wählen, nur unter den erlaubten. */
export const withGround = (
  plan: ProductionPlan,
  planet: PlanetId,
  groundPlanets: readonly PlanetId[],
): ProductionPlan => (groundPlanets.includes(planet) ? { ...plan, groundPlanet: planet } : plan);

/** Ob bestellte Bodentruppen einen Planeten brauchen. */
export const needsGround = (plan: ProductionPlan, choices: readonly ProductionChoice[]): boolean =>
  choices.some((choice) => (plan.orders[choice.unit.id] ?? 0) > 0 && isGroundForce(choice.unit));

/** Der gewählte Planet, wenn er erlaubt ist, sonst der erste mögliche (wie im Formular). */
export const groundOf = (
  plan: ProductionPlan,
  groundPlanets: readonly PlanetId[],
): PlanetId | null =>
  plan.groundPlanet !== null && groundPlanets.includes(plan.groundPlanet)
    ? plan.groundPlanet
    : (groundPlanets[0] ?? null);

/** Was gesendet wird; ohne Bestellung wird nichts bezahlt und kein Planet genannt. */
export function requestOf(
  plan: ProductionPlan,
  groundPlanet: PlanetId | null,
  needsPlanet: boolean,
): ProductionRequest {
  const orders = ordersOf(plan);
  if (orders.length === 0) return { orders, payment: NO_PAYMENT, groundPlanet: null };
  const ground = needsPlanet ? groundPlanet : null;
  return { orders, payment: paymentOf(plan.payment), groundPlanet: ground };
}
