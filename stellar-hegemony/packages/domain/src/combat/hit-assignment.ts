import { type Check, type DomainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { UnitId } from '../shared/ids.ts';
import { map, type Result } from '../shared/result.ts';
import { canSustainDamage } from '../unit/unit-capabilities.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { Unit } from '../unit/unit.ts';
import { absorbableHits } from './combat-queries.ts';

/** Wie ein Spieler Treffer abfängt: Schadensresistenz nutzen oder Einheiten zerstören. */
export interface HitAssignment {
  readonly sustained: readonly UnitId[];
  readonly destroyed: readonly UnitId[];
}

const canSustain = (unit: Unit, catalog: UnitCatalog): boolean => {
  const definition = catalog.find(unit.type, unit.owner);
  return !unit.damaged && definition !== undefined && canSustainDamage(definition);
};

const unique = (ids: readonly UnitId[]): boolean => new Set(ids).size === ids.length;

function assignmentChecks(
  units: readonly Unit[],
  required: number,
  { sustained, destroyed }: HitAssignment,
  catalog: UnitCatalog,
): readonly Check[] {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const all = [...sustained, ...destroyed];
  const known = all.every((id) => byId.has(id));
  const sustainable = sustained.every((id) => {
    const unit = byId.get(id);
    return unit !== undefined && canSustain(unit, catalog);
  });
  return [
    guard(known, 'combat.unknownUnit', 'Einheit nicht im Kampf'),
    guard(unique(sustained) && unique(destroyed), 'combat.duplicateHit', 'Einheit doppelt gewählt'),
    guard(sustainable, 'combat.cannotSustain', 'Keine Schadensresistenz mehr'),
    guard(all.length === required, 'combat.hitCount', 'Falsche Anzahl Treffer', { required }),
  ];
}

/** RR 89.1 und RR 66: genau so viele Zuweisungen wie Treffer, höchstens so viele wie möglich. */
export function validateHitAssignment(
  units: readonly Unit[],
  hits: number,
  assignment: HitAssignment,
  catalog: UnitCatalog,
): Result<HitAssignment, DomainError> {
  const required = Math.min(hits, absorbableHits(units, catalog));
  const checks = assignmentChecks(units, required, assignment, catalog);
  return map(firstFailure(checks), () => assignment);
}

const valueOf = (unit: Unit, catalog: UnitCatalog): number => {
  const cost = catalog.find(unit.type, unit.owner)?.cost;
  return cost === undefined ? 0 : cost.resources / cost.unitsPerCost;
};

/**
 * Vorschlag für Oberfläche und Bots: erst Schadensresistenz nutzen, dann die
 * günstigsten Einheiten verlieren (Information Expert über Kosten und Fähigkeiten).
 */
export function suggestHitAssignment(
  units: readonly Unit[],
  hits: number,
  catalog: UnitCatalog,
): HitAssignment {
  const sustained = units.filter((unit) => canSustain(unit, catalog)).slice(0, hits);
  const remaining = Math.max(0, hits - sustained.length);
  const byValue = [...units].sort((a, b) => valueOf(a, catalog) - valueOf(b, catalog));
  const destroyed = byValue.slice(0, remaining);
  return { sustained: sustained.map((u) => u.id), destroyed: destroyed.map((u) => u.id) };
}
