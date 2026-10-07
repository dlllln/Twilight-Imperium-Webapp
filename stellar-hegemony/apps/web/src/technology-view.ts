import {
  type ContentPort,
  findPlanetDefinition,
  type GameState,
  missingPrerequisites,
  ownedTechnologies,
  type PlanetId,
  type PlayerId,
  type TechnologyColor,
  type TechnologyDefinition,
  type TechnologyId,
} from '@stellar/domain';

export interface ResearchOption {
  readonly technology: TechnologyDefinition;
  /** Farben, die nach den bereits gewählten Technologien noch fehlen. */
  readonly missing: readonly TechnologyColor[];
}

/**
 * Noch nicht erforschte Technologien mit ihren fehlenden Voraussetzungen. Gewählte
 * Technologien zählen schon mit, so wie die Domain der Reihe nach erforscht.
 */
export function researchOptions(
  game: GameState,
  player: PlayerId,
  content: ContentPort,
  chosen: readonly TechnologyId[] = [],
): readonly ResearchOption[] {
  const owned = ownedTechnologies(game, player, content);
  const picked = chosen.flatMap((id) => content.technologies.find((tech) => tech.id === id) ?? []);
  return content.technologies
    .filter((tech) => !owned.some((own) => own.id === tech.id))
    .map((technology) => ({
      technology,
      missing: missingPrerequisites(
        [...owned, ...picked.filter((tech) => tech.id !== technology.id)],
        technology,
      ),
    }));
}

export interface SpecialtyPlanet {
  readonly planet: PlanetId;
  readonly color: TechnologyColor;
}

/** Eigene, bereite Planeten mit Technologie-Spezialisierung (RR 80.14/80.15). */
export function specialtyPlanets(
  game: GameState,
  player: PlayerId,
  content: ContentPort,
): readonly SpecialtyPlanet[] {
  return Object.values(game.planets).flatMap((planet) => {
    const color = findPlanetDefinition(content.tiles, planet.id)?.technologySpecialty;
    const usable = planet.controller === player && !planet.exhausted && color !== undefined;
    return usable ? [{ planet: planet.id, color }] : [];
  });
}
