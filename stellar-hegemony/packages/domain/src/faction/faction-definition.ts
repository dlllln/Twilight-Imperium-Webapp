import type { SystemTile } from '../galaxy/system-tile.ts';
import type { FactionId, PlanetId, TechnologyId, UnitTypeId } from '../shared/ids.ts';
import type { FactionAbility } from './faction-ability.ts';

/** Mehrere gleiche Einheiten, z. B. „3 Jäger“. */
export interface UnitStack {
  readonly type: UnitTypeId;
  readonly count: number;
}

export interface PlanetForces {
  readonly planet: PlanetId;
  readonly units: readonly UnitStack[];
}

/** Startaufstellung im Heimatsystem (RR 76 ff. Spielaufbau, Schritt Startflotte). */
export interface StartingForces {
  readonly space: readonly UnitStack[];
  readonly planets: readonly PlanetForces[];
}

/** Stammdaten einer Fraktion: Heimat, Startaufstellung, Rohstoffe, Technologien, Fähigkeiten. */
export interface FactionDefinition {
  readonly id: FactionId;
  readonly homeSystem: SystemTile;
  readonly startingForces: StartingForces;
  readonly commodityLimit: number;
  /** RR 80.5: Technologien, die die Fraktion zu Spielbeginn besitzt. */
  readonly startingTechnologies: readonly TechnologyId[];
  readonly abilities: readonly FactionAbility[];
}
