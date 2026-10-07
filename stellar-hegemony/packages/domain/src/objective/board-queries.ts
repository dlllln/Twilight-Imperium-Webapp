import { adjacentSystemIds } from '../galaxy/adjacency.ts';
import type { SystemState } from '../galaxy/system-state.ts';
import type { GameState } from '../game/game-state.ts';
import { findPlayer } from '../game/game-state.ts';
import { isCenterSystem } from '../invasion/invasion-queries.ts';
import type { PlanetDefinition } from '../planet/planet-definition.ts';
import type { PlanetState } from '../planet/planet-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlayerId, SystemId } from '../shared/ids.ts';
import { findPlanetDefinition } from '../economy/payment.ts';
import type { Unit } from '../unit/unit.ts';

/** Heimatsystem eines Spielers laut seiner Fraktion. */
export function homeSystemIdOf(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): SystemId | undefined {
  const faction = findPlayer(state, player)?.faction;
  return content.factions.find((candidate) => candidate.id === faction)?.homeSystem.id;
}

/** Heimatsysteme aller anderen Spieler. */
export const foreignHomes = (state: GameState, player: PlayerId, content: ContentPort) =>
  state.players
    .filter((other) => other.id !== player)
    .flatMap((other) => homeSystemIdOf(state, other.id, content) ?? []);

export interface OwnPlanet {
  readonly state: PlanetState;
  readonly definition: PlanetDefinition;
}

/** Kontrollierte Planeten samt Stammdaten (RR 47). */
export function ownPlanets(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): readonly OwnPlanet[] {
  return Object.values(state.planets).flatMap((planet) => {
    const definition = findPlanetDefinition(content.tiles, planet.id);
    return planet.controller === player && definition !== undefined
      ? [{ state: planet, definition }]
      : [];
  });
}

/** System, in dem ein Planet liegt. */
export const systemOfPlanet = (state: GameState, planet: string): SystemState | undefined =>
  Object.values(state.systems).find((system) => system.planetIds.some((id) => id === planet));

/** RR 12.16: Wer nicht alle Planeten seines Heimatsystems kontrolliert, wertet nichts Öffentliches. */
export function controlsHomeSystem(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): boolean {
  const home = state.systems[homeSystemIdOf(state, player, content) ?? ''];
  return (
    home !== undefined &&
    home.planetIds.every((planet) => state.planets[planet]?.controller === player)
  );
}

export const centerSystems = (state: GameState, content: ContentPort): readonly SystemState[] =>
  Object.values(state.systems).filter((system) => isCenterSystem(content.tiles, system.id));

/** Ob ein Spieler einen Planeten im Zentrum (der Thronwelt) kontrolliert. */
export const controlsCenter = (state: GameState, player: PlayerId, content: ContentPort) =>
  centerSystems(state, content).some((system) =>
    system.planetIds.some((planet) => state.planets[planet]?.controller === player),
  );

export const adjacentToCenter = (state: GameState, system: SystemState, content: ContentPort) =>
  centerSystems(state, content).some((center) =>
    adjacentSystemIds(state.systems, center).includes(system.id),
  );

/** Alle eigenen Einheiten auf dem Spielplan, im Weltraum und auf Planeten. */
export function unitsOnBoard(state: GameState, player: PlayerId): readonly Unit[] {
  const space = Object.values(state.systems).flatMap((system) => system.spaceUnits);
  const ground = Object.values(state.planets).flatMap((planet) => planet.units);
  return [...space, ...ground].filter((unit) => unit.owner === player);
}
