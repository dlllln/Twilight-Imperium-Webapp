import {
  type ContentPort,
  type GameState,
  type PlayerId,
  researchOptions as domainResearchOptions,
  type ResearchOption,
  type SpecialtyPlanet,
  specialtyPlanets as domainSpecialtyPlanets,
  type TechnologyId,
} from '@stellar/domain';

/*
 * Ansicht der Forschung für Formular und Tisch. Was fehlt und welche Planeten eine
 * Spezialisierung beisteuern, beantwortet allein die Domain.
 */

export type { ResearchOption, SpecialtyPlanet };

/**
 * Noch nicht erforschte Technologien mit ihren fehlenden Voraussetzungen. Gewählte
 * Technologien zählen schon mit, so wie die Domain der Reihe nach erforscht.
 */
export const researchOptions = (
  game: GameState,
  player: PlayerId,
  content: ContentPort,
  chosen: readonly TechnologyId[] = [],
): readonly ResearchOption[] =>
  domainResearchOptions(game, player, content, { technologies: chosen, specialties: [] });

/** Eigene, bereite Planeten mit Technologie-Spezialisierung (RR 80.14/80.15). */
export const specialtyPlanets = (
  game: GameState,
  player: PlayerId,
  content: ContentPort,
): readonly SpecialtyPlanet[] => domainSpecialtyPlanets(game, player, content);
