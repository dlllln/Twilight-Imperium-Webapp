import { currentPlanetDefinition } from '../economy/payment.ts';
import type { GameState } from '../game/game-state.ts';
import type { TechnologyColor } from '../planet/planet-definition.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import { missingPrerequisites, type ResearchRequest } from './research.ts';
import { ownedTechnologies } from './technology-catalog.ts';
import type { TechnologyDefinition } from './technology-definition.ts';

/** Eine noch nicht erforschte Technologie und die Farben, die ihr dann noch fehlen. */
export interface ResearchOption {
  readonly technology: TechnologyDefinition;
  readonly missing: readonly TechnologyColor[];
}

/** Ein eigener, bereiter Planet mit Technologie-Spezialisierung (RR 80.14). */
export interface SpecialtyPlanet {
  readonly planet: PlanetId;
  readonly color: TechnologyColor;
}

/** Eigene, bereite Planeten mit Spezialisierung, wie `researchEvents` sie annimmt (RR 80.15). */
export function specialtyPlanets(
  state: GameState,
  player: PlayerId,
  content: Pick<ContentPort, 'tiles'>,
): readonly SpecialtyPlanet[] {
  return Object.values(state.planets).flatMap((planet) => {
    const color = currentPlanetDefinition(state, content.tiles, planet.id)?.technologySpecialty;
    const usable = planet.controller === player && !planet.exhausted && color !== undefined;
    return usable ? [{ planet: planet.id, color }] : [];
  });
}

/** Nimmt jede Farbe einmal aus dem Vorrat, soweit sie dort liegt. */
const withoutColors = (
  pool: readonly TechnologyColor[],
  colors: readonly TechnologyColor[],
): readonly TechnologyColor[] =>
  colors.reduce<readonly TechnologyColor[]>((rest, color) => {
    const index = rest.indexOf(color);
    return index === -1 ? rest : [...rest.slice(0, index), ...rest.slice(index + 1)];
  }, pool);

/** Was die Spezialisierungen übrig lassen, wenn die anderen gewählten der Reihe nach decken. */
function leftover(
  owned: readonly TechnologyDefinition[],
  others: readonly TechnologyDefinition[],
  pool: readonly TechnologyColor[],
): readonly TechnologyColor[] {
  const start = { known: owned, pool };
  const end = others.reduce(
    (step, tech) => ({
      known: [...step.known, tech],
      pool: withoutColors(step.pool, missingPrerequisites(step.known, tech)),
    }),
    start,
  );
  return end.pool;
}

/** Die fehlenden Farben, die der Vorrat nicht deckt, in der Reihenfolge der Voraussetzungen. */
function uncovered(
  missing: readonly TechnologyColor[],
  pool: readonly TechnologyColor[],
): readonly TechnologyColor[] {
  const rest = [...pool];
  return missing.filter((color) => {
    const index = rest.indexOf(color);
    if (index === -1) return true;
    rest.splice(index, 1);
    return false;
  });
}

interface Basis {
  readonly owned: readonly TechnologyDefinition[];
  readonly chosen: readonly TechnologyDefinition[];
  readonly pool: readonly TechnologyColor[];
}

function optionOf(basis: Basis, technology: TechnologyDefinition): ResearchOption {
  const others = basis.chosen.filter((tech) => tech.id !== technology.id);
  const missing = missingPrerequisites([...basis.owned, ...others], technology);
  return { technology, missing: uncovered(missing, leftover(basis.owned, others, basis.pool)) };
}

/** Farben der gewählten Spezialisierungen; ungültige Planeten zählen nicht. */
function chosenColors(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
  planets: readonly PlanetId[],
): readonly TechnologyColor[] {
  const usable = specialtyPlanets(state, player, content);
  return planets.flatMap((id) => usable.find((entry) => entry.planet === id)?.color ?? []);
}

/**
 * Information Expert für die Forschungsauslage: jede noch nicht erforschte Technologie mit den
 * Farben, die ihr fehlen. Die anderen gewählten Technologien zählen als Voraussetzung, gewählte
 * Spezialisierungen decken, was sie nach deren Bedarf übrig haben (wie `researchEvents`).
 */
export function researchOptions(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
  request: ResearchRequest,
): readonly ResearchOption[] {
  const owned = ownedTechnologies(state, player, content);
  const chosen = request.technologies.flatMap(
    (id) => content.technologies.find((tech) => tech.id === id) ?? [],
  );
  const basis = { owned, chosen, pool: chosenColors(state, player, content, request.specialties) };
  return content.technologies
    .filter((tech) => !owned.some((own) => own.id === tech.id))
    .map((technology) => optionOf(basis, technology));
}
