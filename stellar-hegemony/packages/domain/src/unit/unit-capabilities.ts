import type {
  CapabilityKind,
  CapabilityOf,
  CombatProfile,
  ProductionCost,
  UnitDefinition,
} from './unit-definition.ts';

/*
 * Interface Segregation: kleine Rollen-Interfaces statt einer großen
 * Basisklasse. Die Type Guards prüfen ausschließlich Daten, nie Typnamen.
 */
export interface CanMove {
  readonly move: number;
}
export interface HasCapacity {
  readonly capacity: number;
}
export interface HasCombat {
  readonly combat: CombatProfile;
}
export interface CanBeProduced {
  readonly cost: ProductionCost;
}

export const canMove = (unit: UnitDefinition): unit is UnitDefinition & CanMove =>
  unit.move !== undefined && unit.move > 0;

export const hasCapacity = (unit: UnitDefinition): unit is UnitDefinition & HasCapacity =>
  unit.capacity !== undefined && unit.capacity > 0;

export const hasCombat = (unit: UnitDefinition): unit is UnitDefinition & HasCombat =>
  unit.combat !== undefined;

export const canBeProduced = (unit: UnitDefinition): unit is UnitDefinition & CanBeProduced =>
  unit.cost !== undefined;

export function findCapability<K extends CapabilityKind>(
  unit: UnitDefinition,
  kind: K,
): CapabilityOf<K> | undefined {
  return unit.capabilities.find(
    (capability): capability is CapabilityOf<K> => capability.kind === kind,
  );
}

export const hasCapability = (unit: UnitDefinition, kind: CapabilityKind): boolean =>
  findCapability(unit, kind) !== undefined;

export const canSustainDamage = (unit: UnitDefinition): boolean =>
  hasCapability(unit, 'sustainDamage');

export const isShip = (unit: UnitDefinition): boolean => unit.category === 'ship';

export const isGroundForce = (unit: UnitDefinition): boolean => unit.category === 'groundForce';

export const isStructure = (unit: UnitDefinition): boolean => unit.category === 'structure';

/** Regel 28: Nur Nicht-Jäger-Schiffe zählen zum Flottenlimit. */
export const countsTowardFleetLimit = (unit: UnitDefinition): boolean =>
  isShip(unit) && !unit.isFighter;

/** Regel 43: Jäger und Bodentruppen im Weltraum belegen Kapazität. */
export const occupiesCapacity = (unit: UnitDefinition): boolean =>
  unit.isFighter || isGroundForce(unit);
