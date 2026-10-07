import { areAdjacentHexes } from '../hex/hex-coordinate.ts';
import type { SystemId } from '../shared/ids.ts';
import type { SystemState } from './system-state.ts';
import type { AnomalyKind, WormholeKind } from './system-tile.ts';

interface Placed {
  readonly anomaly?: AnomalyKind;
  readonly wormholes: readonly WormholeKind[];
}

export const sharesWormhole = (a: Placed, b: Placed): boolean =>
  a.wormholes.some((wormhole) => b.wormholes.includes(wormhole));

/** RR 7/88: benachbart sind Systeme mit gemeinsamer Hex-Kante oder gleichem Wurmloch-Typ. */
export function areSystemsAdjacent(a: SystemState, b: SystemState): boolean {
  if (a.id === b.id) return false;
  return areAdjacentHexes(a.position, b.position) || sharesWormhole(a, b);
}

export function adjacentSystemIds(
  systems: Readonly<Record<string, SystemState>>,
  origin: SystemState,
): readonly SystemId[] {
  return Object.values(systems)
    .filter((candidate) => areSystemsAdjacent(origin, candidate))
    .map((system) => system.id);
}

/** Aufbauregel: Anomalien und gleiche Wurmlöcher sollen nicht nebeneinander liegen. */
export const violatesPlacement = (a: Placed, b: Placed): boolean =>
  (a.anomaly !== undefined && b.anomaly !== undefined) || sharesWormhole(a, b);
