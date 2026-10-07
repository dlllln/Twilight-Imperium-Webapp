import { adjacentSystemIds } from '../galaxy/adjacency.ts';
import type { SystemState } from '../galaxy/system-state.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlayerId, SystemId } from '../shared/ids.ts';
import { canSustainDamage, findCapability, isShip } from '../unit/unit-capabilities.ts';
import type { CapabilityKind, CapabilityOf } from '../unit/unit-definition.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { Unit } from '../unit/unit.ts';
import type { Shooter } from './dice.ts';

const shipFilter = (catalog: UnitCatalog) => (unit: Unit) => {
  const definition = catalog.find(unit.type, unit.owner);
  return definition !== undefined && isShip(definition);
};

/** Schiffe (inklusive Jäger) eines Spielers im Weltraumbereich eines Systems. */
export function shipsOf(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  catalog: UnitCatalog,
): readonly Unit[] {
  const units = state.systems[system]?.spaceUnits ?? [];
  return units.filter((unit) => unit.owner === player).filter(shipFilter(catalog));
}

/** Spieler mit Schiffen im System, in der Reihenfolge ihres ersten Auftretens. */
export function playersWithShips(
  state: GameState,
  system: SystemId,
  catalog: UnitCatalog,
): readonly PlayerId[] {
  const units = (state.systems[system]?.spaceUnits ?? []).filter(shipFilter(catalog));
  return [...new Set(units.map((unit) => unit.owner))];
}

export const opponentWithShips = (
  state: GameState,
  system: SystemId,
  player: PlayerId,
  catalog: UnitCatalog,
): PlayerId | null => playersWithShips(state, system, catalog).find((id) => id !== player) ?? null;

/** Entfernungen in Systemschritten (inklusive Wurmlöchern) bis `maxRange`. */
export function distancesFrom(
  state: GameState,
  origin: SystemState,
  maxRange: number,
): ReadonlyMap<SystemId, number> {
  const distances = new Map<SystemId, number>([[origin.id, 0]]);
  let frontier: readonly SystemState[] = [origin];
  for (let range = 1; range <= maxRange; range++) {
    const next = frontier
      .flatMap((system) => adjacentSystemIds(state.systems, system))
      .filter((id) => !distances.has(id));
    for (const id of next) distances.set(id, range);
    frontier = next.flatMap((id) => state.systems[id] ?? []);
  }
  return distances;
}

/** Alle Einheiten eines Spielers in einem System: Weltraum und Planeten. */
export function unitsInSystem(state: GameState, system: SystemState): readonly Unit[] {
  const onPlanets = system.planetIds.flatMap((id) => state.planets[id]?.units ?? []);
  return [...system.spaceUnits, ...onPlanets];
}

function capabilityOf<K extends CapabilityKind>(
  catalog: UnitCatalog,
  unit: Unit,
  kind: K,
): CapabilityOf<K> | undefined {
  const definition = catalog.find(unit.type, unit.owner);
  return definition === undefined ? undefined : findCapability(definition, kind);
}

const maxCannonRange = (catalog: UnitCatalog): number =>
  Math.max(0, ...catalog.all().map((d) => findCapability(d, 'spaceCannon')?.range ?? 0));

/** RR 87.3: Weltraumkanonen eines Spielers, deren Reichweite das aktive System erfasst. */
export function spaceCannonShooters(
  state: GameState,
  active: SystemId,
  owner: PlayerId,
  catalog: UnitCatalog,
): readonly Shooter[] {
  const origin = state.systems[active];
  if (origin === undefined) return [];
  const distances = distancesFrom(state, origin, maxCannonRange(catalog));
  return [...distances].flatMap(([id, distance]) => {
    const system = state.systems[id];
    const units = system === undefined ? [] : unitsInSystem(state, system);
    return units.flatMap((unit) => {
      const cannon = capabilityOf(catalog, unit, 'spaceCannon');
      const fires = unit.owner === owner && cannon !== undefined && cannon.range >= distance;
      return fires ? [{ unit, profile: cannon.profile }] : [];
    });
  });
}

/** Kampfwerte der Schiffe (RR 44). */
export const combatShooters = (ships: readonly Unit[], catalog: UnitCatalog): readonly Shooter[] =>
  ships.flatMap((unit) => {
    const profile = catalog.find(unit.type, unit.owner)?.combat;
    return profile === undefined ? [] : [{ unit, profile }];
  });

export const barrageShooters = (ships: readonly Unit[], catalog: UnitCatalog): readonly Shooter[] =>
  ships.flatMap((unit) => {
    const barrage = capabilityOf(catalog, unit, 'antiFighterBarrage');
    return barrage === undefined ? [] : [{ unit, profile: barrage.profile }];
  });

/** Wie viele Treffer die Einheiten höchstens abfangen können: Zerstörung plus Schadensresistenz. */
export function absorbableHits(units: readonly Unit[], catalog: UnitCatalog): number {
  const sustainable = units.filter((unit) => {
    const definition = catalog.find(unit.type, unit.owner);
    return !unit.damaged && definition !== undefined && canSustainDamage(definition);
  });
  return units.length + sustainable.length;
}
