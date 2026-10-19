import {
  constructionSites,
  type ContentPort,
  findPlayer,
  type GameState,
  hasCapability,
  isStructure,
  type PlanetId,
  type PlayerId,
  type SystemId,
  type UnitDefinition,
  warfareTokenSystems,
} from '@stellar/domain';
import { content as baseContent } from './store.ts';

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

/**
 * Infrastruktur sekundär: Systeme ohne eigenen Marker, in denen ein eigener Planet noch Platz für
 * ein Gebäude hat (laut Domain; ohne Marker im Nachschub keines).
 */
export const constructionSystems = (game: GameState, player: PlayerId): readonly SystemId[] => [
  ...new Set(
    constructionSites(game, player, baseContent.units, 'secondary').map((site) => site.system),
  ),
];

/** Kriegsführung primär: Systeme, in denen ein eigener Marker liegt. */
export const systemsWithToken = (game: GameState, player: PlayerId): readonly SystemId[] =>
  warfareTokenSystems(game, player);

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
