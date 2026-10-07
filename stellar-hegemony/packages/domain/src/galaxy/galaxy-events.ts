import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { Hex } from '../hex/hex-coordinate.ts';
import type { PlanetId, SystemId } from '../shared/ids.ts';
import type { AnomalyKind, WormholeKind } from './system-tile.ts';

export interface PlacedSystem {
  readonly id: SystemId;
  readonly position: Hex;
  readonly planetIds: readonly PlanetId[];
  readonly anomaly?: AnomalyKind;
  readonly wormholes: readonly WormholeKind[];
}

/** Die Galaxie steht fest. Heimat-Plätze sind in Sitzreihenfolge sortiert. */
export interface GalaxyAssembled extends DomainEvent<'GalaxyAssembled'> {
  readonly systems: readonly PlacedSystem[];
  readonly homeSlots: readonly Hex[];
}

export type GalaxyEvent = GalaxyAssembled;
