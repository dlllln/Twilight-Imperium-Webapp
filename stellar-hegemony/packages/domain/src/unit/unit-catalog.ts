import { type DomainError, domainError } from '../shared/domain-error.ts';
import type { PlayerId, UnitTypeId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { UnitDefinition } from './unit-definition.ts';

/**
 * Lesezugriff auf Einheitenwerte. Mit `owner` liefert ein technologiebewusster
 * Katalog die Werte dieses Spielers (Aufwertungen, Boni); ohne ihn die Grundwerte.
 */
export interface UnitCatalog {
  find(type: UnitTypeId, owner?: PlayerId): UnitDefinition | undefined;
  all(owner?: PlayerId): readonly UnitDefinition[];
}

export function requireUnitDefinition(
  catalog: UnitCatalog,
  type: UnitTypeId,
  owner?: PlayerId,
): Result<UnitDefinition, DomainError> {
  const definition = catalog.find(type, owner);
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
