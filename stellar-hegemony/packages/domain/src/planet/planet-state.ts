import type { ExplorationCardId, PlanetId, PlayerId } from '../shared/ids.ts';
import type { Unit } from '../unit/unit.ts';
import type { TechnologyColor } from './planet-definition.ts';

/** PoK Erkundung: eine Karte, die auf dem Planeten liegt und seine Werte ändert. */
export interface PlanetAttachment {
  readonly card: ExplorationCardId;
  readonly resources: number;
  readonly influence: number;
  readonly specialty?: TechnologyColor;
}

/** Veränderlicher Zustand eines Planeten innerhalb einer Partie. */
export interface PlanetState {
  readonly id: PlanetId;
  readonly controller: PlayerId | null;
  readonly exhausted: boolean;
  /** Bodentruppen und Gebäude auf dem Planeten. */
  readonly units: readonly Unit[];
  /** PoK Erkundung: angelegte Karten; fehlt, solange keine anliegt. */
  readonly attachments?: readonly PlanetAttachment[];
}

export const unclaimedPlanet = (id: PlanetId): PlanetState => ({
  id,
  controller: null,
  exhausted: false,
  units: [],
});
