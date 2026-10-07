import type { SystemId } from '../shared/ids.ts';
import type { PlanetDefinition } from '../planet/planet-definition.ts';

export type AnomalyKind = 'asteroidField' | 'nebula' | 'supernova' | 'gravityRift';

export type WormholeKind = 'alpha' | 'beta';

/** Rückseitenfarbe der Systemtafel: steuert Verteilung beim Galaxie-Aufbau. */
export type TileBack = 'center' | 'home' | 'blue' | 'red';

/** Stammdaten einer Systemtafel (aus dem Content-Paket). */
export interface SystemTile {
  readonly id: SystemId;
  readonly back: TileBack;
  readonly planets: readonly PlanetDefinition[];
  readonly anomaly?: AnomalyKind;
  readonly wormholes: readonly WormholeKind[];
}
