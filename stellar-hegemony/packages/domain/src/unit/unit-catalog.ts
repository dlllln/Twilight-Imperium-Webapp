import { type DomainError, domainError } from '../shared/domain-error.ts';
import type { UnitTypeId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { UnitDefinition } from './unit-definition.ts';

/**
 * Lesezugriff auf Einheitenwerte. Spätere Iterationen liefern pro Spieler
 * einen Katalog mit angewendeten Technologie-Upgrades (Open/Closed).
 */
export interface UnitCatalog {
  find(type: UnitTypeId): UnitDefinition | undefined;
  all(): readonly UnitDefinition[];
}

export function requireUnitDefinition(
  catalog: UnitCatalog,
  type: UnitTypeId,
): Result<UnitDefinition, DomainError> {
  const definition = catalog.find(type);
  return definition === undefined
    ? err(domainError('unit.unknownType', `Unbekannter Einheitentyp: ${type}`, { type }))
    : ok(definition);
}

/** Unveränderlicher Katalog aus einer Liste von Definitionen. */
export class StaticUnitCatalog implements UnitCatalog {
  private readonly byId: ReadonlyMap<UnitTypeId, UnitDefinition>;

  constructor(definitions: readonly UnitDefinition[]) {
    this.byId = new Map(definitions.map((definition) => [definition.id, definition]));
  }

  find(type: UnitTypeId): UnitDefinition | undefined {
    return this.byId.get(type);
  }

  all(): readonly UnitDefinition[] {
    return [...this.byId.values()];
  }
}
