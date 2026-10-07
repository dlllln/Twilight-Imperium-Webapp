import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlacedSystem } from '../galaxy/galaxy-events.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import type { FactionRules } from './faction-ability.ts';
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

/** Die Fähigkeiten der Fraktion gelten ab Spielstart für diesen Spieler. */
export interface FactionAbilitiesGranted extends DomainEvent<'FactionAbilitiesGranted'> {
  readonly player: PlayerId;
  readonly rules: FactionRules;
}

export type HomeEvent = HomeSystemPlaced | FactionAbilitiesGranted;
