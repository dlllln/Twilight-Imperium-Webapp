import type { PlanetId, PlayerId } from '../shared/ids.ts';
import type { Unit } from '../unit/unit.ts';

/** Veränderlicher Zustand eines Planeten innerhalb einer Partie. */
export interface PlanetState {
  readonly id: PlanetId;
  readonly controller: PlayerId | null;
  readonly exhausted: boolean;
  /** Bodentruppen und Gebäude auf dem Planeten. */
  readonly units: readonly Unit[];
}

export const unclaimedPlanet = (id: PlanetId): PlanetState => ({
  id,
  controller: null,
  exhausted: false,
  units: [],
});
