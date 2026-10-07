import type { TileCatalog } from '../galaxy/tile-catalog.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import { findCapability, hasCapability, isGroundForce } from '../unit/unit-capabilities.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { CapabilityKind } from '../unit/unit-definition.ts';
import type { Unit } from '../unit/unit.ts';

const isGround = (catalog: UnitCatalog) => (unit: Unit) => {
  const definition = catalog.find(unit.type, unit.owner);
  return definition !== undefined && isGroundForce(definition);
};

/** Bodentruppen eines Spielers (oder aller anderen) auf einem Planeten. */
export function groundForcesOn(
  state: GameState,
  planet: PlanetId,
  catalog: UnitCatalog,
  owner: (id: PlayerId) => boolean,
): readonly Unit[] {
  const units = state.planets[planet]?.units ?? [];
  return units.filter((unit) => owner(unit.owner)).filter(isGround(catalog));
}

/** Bodentruppen des aktiven Spielers im Weltraum des Systems: bereit zur Landung (RR 25.2). */
export function landingForces(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  catalog: UnitCatalog,
): readonly Unit[] {
  const space = state.systems[system]?.spaceUnits ?? [];
  return space.filter((unit) => unit.owner === player).filter(isGround(catalog));
}

const has = (catalog: UnitCatalog, unit: Unit, kind: CapabilityKind): boolean => {
  const definition = catalog.find(unit.type, unit.owner);
  return definition !== undefined && hasCapability(definition, kind);
};

/** Eigene Schiffe mit Bombardement im System (RR 20.1). */
export function bombardingShips(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  catalog: UnitCatalog,
): readonly Unit[] {
  const space = state.systems[system]?.spaceUnits ?? [];
  return space.filter((unit) => unit.owner === player && has(catalog, unit, 'bombardment'));
}

/** RR 60: Ein fremder Planetarer Schild verhindert Bombardement, außer eine eigene Einheit hebt ihn auf. */
export function isShielded(
  state: GameState,
  system: SystemId,
  planet: PlanetId,
  player: PlayerId,
  catalog: UnitCatalog,
): boolean {
  const space = state.systems[system]?.spaceUnits ?? [];
  const lifted = space.some(
    (unit) => unit.owner === player && has(catalog, unit, 'ignoresPlanetaryShield'),
  );
  const shielded = (state.planets[planet]?.units ?? []).some(
    (unit) => unit.owner !== player && has(catalog, unit, 'planetaryShield'),
  );
  return shielded && !lifted;
}

/** Planeten im System, deren fremde Bodentruppen bombardiert werden dürfen. */
export function bombardablePlanets(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  catalog: UnitCatalog,
): readonly PlanetId[] {
  const planets = state.systems[system]?.planetIds ?? [];
  return planets.filter(
    (planet) =>
      groundForcesOn(state, planet, catalog, (owner) => owner !== player).length > 0 &&
      !isShielded(state, system, planet, player, catalog),
  );
}

/** RR 20.1: Bombardement-Werte einer Einheit. */
export const bombardmentOf = (unit: Unit, catalog: UnitCatalog) => {
  const definition = catalog.find(unit.type, unit.owner);
  return definition === undefined ? undefined : findCapability(definition, 'bombardment');
};

/** Das Zentrumssystem mit der Thronwelt (Tafel mit der Rückseite „center“). */
export const isCenterSystem = (tiles: TileCatalog, system: SystemId): boolean =>
  tiles.find(system)?.back === 'center';
