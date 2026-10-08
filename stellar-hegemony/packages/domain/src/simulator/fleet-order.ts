import { type Check, type DomainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { PlayerId, UnitTypeId } from '../shared/ids.ts';
import { map, type Result } from '../shared/result.ts';
import { isShip } from '../unit/unit-capabilities.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { UnitDefinition } from '../unit/unit-definition.ts';
import { UnitNumbering } from '../unit/unit-numbering.ts';
import type { Unit } from '../unit/unit.ts';

/** Bestellte Schiffe je Typ. */
export type FleetOrder = Readonly<Partial<Record<UnitTypeId, number>>>;

/** Grenzen beim Flottenbau: Ressourcen und Zahl der Einheiten (Produktionslimit). */
export interface FleetRules {
  readonly budget: number;
  readonly productionLimit: number;
}

export interface FleetSummary {
  readonly cost: number;
  readonly units: number;
  /** Plätze für Jäger auf Trägern und anderen Schiffen mit Kapazität. */
  readonly capacity: number;
  readonly fighters: number;
  readonly warships: number;
}

const entries = (order: FleetOrder) => Object.entries(order) as [UnitTypeId, number | undefined][];

/** Kosten eines Postens: Jäger kommen paarweise, angebrochene Paare kosten voll (RR 67.2). */
export function costOf(definition: UnitDefinition, count: number): number {
  const cost = definition.cost;
  if (cost === undefined || count === 0) return 0;
  return Math.ceil(count / cost.unitsPerCost) * cost.resources;
}

export function summarizeFleet(
  order: FleetOrder,
  catalog: UnitCatalog,
  owner: PlayerId,
): FleetSummary {
  return entries(order).reduce<FleetSummary>(
    (sum, [type, count = 0]) => {
      const definition = catalog.find(type, owner);
      if (definition === undefined) return sum;
      return {
        cost: sum.cost + costOf(definition, count),
        units: sum.units + count,
        capacity: sum.capacity + (definition.capacity ?? 0) * count,
        fighters: sum.fighters + (definition.isFighter ? count : 0),
        warships: sum.warships + (definition.isFighter ? 0 : count),
      };
    },
    { cost: 0, units: 0, capacity: 0, fighters: 0, warships: 0 },
  );
}

const withinLimit = (definition: UnitDefinition | undefined, count: number): boolean =>
  definition !== undefined &&
  isShip(definition) &&
  (definition.componentLimit === 'unlimited' || count <= definition.componentLimit);

const limitsKept = (order: FleetOrder, catalog: UnitCatalog, owner: PlayerId): boolean =>
  entries(order).every(
    ([type, count = 0]) => count >= 0 && withinLimit(catalog.find(type, owner), count),
  );

function orderChecks(
  order: FleetOrder,
  catalog: UnitCatalog,
  owner: PlayerId,
  rules: FleetRules,
): readonly Check[] {
  const summary = summarizeFleet(order, catalog, owner);
  return [
    guard(limitsKept(order, catalog, owner), 'simulator.unitLimit', 'Vorrat erschöpft'),
    guard(summary.cost <= rules.budget, 'simulator.budget', 'Zu teuer', { budget: rules.budget }),
    guard(
      summary.units <= rules.productionLimit,
      'simulator.productionLimit',
      'Zu viele Einheiten',
    ),
    guard(summary.fighters <= summary.capacity, 'simulator.capacity', 'Zu wenig Platz für Jäger'),
    guard(summary.warships > 0, 'simulator.emptyFleet', 'Mindestens ein Kriegsschiff'),
  ];
}

/** Prüft eine Bestellung gegen Vorrat, Ressourcen, Produktionslimit und Kapazität. */
export function validateFleet(
  order: FleetOrder,
  catalog: UnitCatalog,
  owner: PlayerId,
  rules: FleetRules,
): Result<FleetOrder, DomainError> {
  return map(firstFailure(orderChecks(order, catalog, owner, rules)), () => order);
}

/** Einheiten einer gültigen Bestellung; Ids ab `firstNumber`, damit beide Seiten verschieden sind. */
export function fleetUnits(
  order: FleetOrder,
  owner: PlayerId,
  firstNumber: number,
): readonly Unit[] {
  const stacks = entries(order).map(([type, count = 0]) => ({ type, count }));
  return new UnitNumbering(firstNumber).create(owner, stacks);
}
