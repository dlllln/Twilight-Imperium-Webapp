import type { Hex } from '../hex/hex-coordinate.ts';
import type { PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import type { Unit } from '../unit/unit.ts';

/** Zustand eines Systems auf dem Spielplan. */
export interface SystemState {
  readonly id: SystemId;
  readonly position: Hex;
  readonly planetIds: readonly PlanetId[];
  /** Schiffe sowie transportierte Jäger und Bodentruppen im Weltraumbereich. */
  readonly spaceUnits: readonly Unit[];
  /** Spieler, die hier einen Kommandomarker liegen haben. */
  readonly commandTokens: readonly PlayerId[];
}
