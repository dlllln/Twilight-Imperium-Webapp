import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlacedSystem } from '../galaxy/galaxy-events.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import type { Unit } from '../unit/unit.ts';

export interface PlacedPlanetUnits {
  readonly planet: PlanetId;
  readonly units: readonly Unit[];
}

/** Heimatsystem eines Spielers liegt auf seinem Heimat-Platz, mit Startflotte; er kontrolliert die Planeten. */
export interface HomeSystemPlaced extends DomainEvent<'HomeSystemPlaced'> {
  readonly player: PlayerId;
  readonly system: PlacedSystem;
  readonly spaceUnits: readonly Unit[];
  readonly planets: readonly PlacedPlanetUnits[];
}

export type HomeEvent = HomeSystemPlaced;
