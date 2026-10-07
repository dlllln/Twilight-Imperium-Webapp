import {
  type ContentPort,
  findPlayer,
  type GameState,
  hasCapability,
  isStructure,
  type PlanetId,
  type PlayerId,
  type SystemId,
  type UnitDefinition,
} from '@stellar/domain';

/** Gebäudetypen aus den Stammdaten; mit `cannonOnly` nur solche mit Weltraumkanone. */
export const structureTypes = (
  content: ContentPort,
  cannonOnly = false,
): readonly UnitDefinition[] =>
  content.units
    .all()
    .filter(isStructure)
    .filter((unit) => !cannonOnly || hasCapability(unit, 'spaceCannon'));

export const ownPlanets = (game: GameState, player: PlayerId): readonly PlanetId[] =>
  Object.values(game.planets)
    .filter((planet) => planet.controller === player)
    .map((planet) => planet.id);

/** Infrastruktur sekundär: Systeme mit eigenem Planeten, in denen noch kein eigener Marker liegt. */
export const constructionSystems = (game: GameState, player: PlayerId): readonly SystemId[] =>
  Object.values(game.systems)
    .filter((system) => !system.commandTokens.includes(player))
    .filter((system) => system.planetIds.some((id) => game.planets[id]?.controller === player))
    .map((system) => system.id);

/** Kriegsführung primär: Systeme, in denen ein eigener Marker liegt. */
export const systemsWithToken = (game: GameState, player: PlayerId): readonly SystemId[] =>
  Object.values(game.systems)
    .filter((system) => system.commandTokens.includes(player))
    .map((system) => system.id);

/** Heimatsystem laut Fraktion des Spielers. */
export function homeSystemOf(
  game: GameState,
  player: PlayerId,
  content: ContentPort,
): SystemId | null {
  const faction = findPlayer(game, player)?.faction;
  const home = content.factions.find((candidate) => candidate.id === faction)?.homeSystem.id;
  return home !== undefined && game.systems[home] !== undefined ? home : null;
}
