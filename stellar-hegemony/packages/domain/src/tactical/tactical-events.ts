import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlanetId, PlayerId, SystemId, UnitId } from '../shared/ids.ts';

/** RR 79.1: Kommandomarker aus dem Taktikpool liegt im aktivierten System. */
export interface SystemActivated extends DomainEvent<'SystemActivated'> {
  readonly player: PlayerId;
  readonly system: SystemId;
}

/** Herkunft einer transportierten Einheit: Weltraumbereich oder Planet eines Systems. */
export interface CargoPickup {
  readonly unit: UnitId;
  readonly system: SystemId;
  readonly planet: PlanetId | null;
}

export interface ShipMovement {
  readonly ship: UnitId;
  readonly from: SystemId;
  /** Durchflogene Systeme in Reihenfolge; das letzte ist das aktive System. */
  readonly path: readonly SystemId[];
  readonly cargo: readonly CargoPickup[];
}

/** RR 15.9: Alle Schiffe bewegen sich gleichzeitig ins aktive System. */
export interface ShipsMoved extends DomainEvent<'ShipsMoved'> {
  readonly player: PlayerId;
  readonly system: SystemId;
  readonly movements: readonly ShipMovement[];
}

/** Würfelwurf für ein Schiff, das einen Gravitationsstrudel verlässt. */
export interface GravityRiftRolled extends DomainEvent<'GravityRiftRolled'> {
  readonly player: PlayerId;
  readonly ship: UnitId;
  readonly roll: number;
  readonly destroyed: boolean;
}

export interface UnitsDestroyed extends DomainEvent<'UnitsDestroyed'> {
  readonly system: SystemId;
  readonly units: readonly UnitId[];
}

export interface TacticalActionEnded extends DomainEvent<'TacticalActionEnded'> {
  readonly player: PlayerId;
}

export type TacticalEvent =
  SystemActivated | ShipsMoved | GravityRiftRolled | UnitsDestroyed | TacticalActionEnded;
