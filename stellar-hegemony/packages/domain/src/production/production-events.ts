import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import type { Unit } from '../unit/unit.ts';

/** RR 62, RR 24: Neue Einheiten erscheinen im System; Bodentruppen auf einem Planeten. */
export interface UnitsProduced extends DomainEvent<'UnitsProduced'> {
  readonly player: PlayerId;
  readonly system: SystemId;
  readonly space: readonly Unit[];
  readonly planet: PlanetId | null;
  readonly ground: readonly Unit[];
}

/** Gebäude werden direkt auf Planeten gesetzt (z. B. durch Konstruktion), ohne Kosten. */
export interface StructuresPlaced extends DomainEvent<'StructuresPlaced'> {
  readonly player: PlayerId;
  readonly placements: readonly { readonly planet: PlanetId; readonly unit: Unit }[];
}

/** PoK Mech: Eine Fraktionsfähigkeit setzt Einheiten kostenlos aus der Verstärkung auf einen Planeten. */
export interface UnitsDeployed extends DomainEvent<'UnitsDeployed'> {
  readonly player: PlayerId;
  /** Id der auslösenden Fraktionsfähigkeit. */
  readonly ability: string;
  readonly planet: PlanetId;
  readonly units: readonly Unit[];
}

export type ProductionEvent = UnitsProduced | StructuresPlaced | UnitsDeployed;
