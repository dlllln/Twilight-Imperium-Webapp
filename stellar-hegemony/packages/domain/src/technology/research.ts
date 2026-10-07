import { findPlanetDefinition } from '../economy/payment.ts';
import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import type { TechnologyColor } from '../planet/planet-definition.ts';
import type { ContentPort } from '../ports/content-port.ts';
import { type Check, type DomainError, domainError, guard } from '../shared/domain-error.ts';
import type { PlanetId, PlayerId, TechnologyId } from '../shared/ids.ts';
import { andThen, err, ok, type Result } from '../shared/result.ts';
import { ownedTechnologies } from './technology-catalog.ts';
import type { TechnologyDefinition } from './technology-definition.ts';

/** Was erforscht wird und welche Planeten-Spezialisierungen Voraussetzungen ersetzen (RR 80.14). */
export interface ResearchRequest {
  readonly technologies: readonly TechnologyId[];
  readonly specialties: readonly PlanetId[];
}

/** Fehlende Voraussetzungen als Mehrfachmenge von Farben (RR 80.12). */
export function missingPrerequisites(
  owned: readonly TechnologyDefinition[],
  technology: TechnologyDefinition,
): readonly TechnologyColor[] {
  const available = owned.flatMap((tech) => (tech.color === null ? [] : [tech.color]));
  return technology.prerequisites.filter((color) => {
    const index = available.indexOf(color);
    if (index === -1) return true;
    available.splice(index, 1);
    return false;
  });
}

/** Entfernt die benötigten Farben aus dem Vorrat; null, wenn er nicht reicht. */
function cover(pool: readonly TechnologyColor[], missing: readonly TechnologyColor[]) {
  const rest = [...pool];
  for (const color of missing) {
    const index = rest.indexOf(color);
    if (index === -1) return null;
    rest.splice(index, 1);
  }
  return rest;
}

/** RR 80.14/80.15: eigener, bereiter Planet mit Spezialisierung. */
function specialtyColors(
  state: GameState,
  player: PlayerId,
  planets: readonly PlanetId[],
  content: ContentPort,
): Result<readonly TechnologyColor[], DomainError> {
  const colors = planets.flatMap((id) => {
    const planet = state.planets[id];
    const color = findPlanetDefinition(content.tiles, id)?.technologySpecialty;
    const usable = planet?.controller === player && !planet.exhausted && color !== undefined;
    return usable ? [color] : [];
  });
  const valid = colors.length === planets.length && new Set(planets).size === planets.length;
  return valid ? ok(colors) : err(domainError('technology.specialty', 'Spezialisierung ungültig'));
}

function knownTechnology(
  id: TechnologyId,
  owned: readonly TechnologyDefinition[],
  content: ContentPort,
): Result<TechnologyDefinition, DomainError> {
  const technology = content.technologies.find((tech) => tech.id === id);
  if (technology === undefined)
    return err(domainError('technology.unknown', 'Unbekannte Technologie', { technology: id }));
  if (owned.some((tech) => tech.id === id))
    return err(domainError('technology.owned', 'Schon erforscht', { technology: id }));
  return ok(technology);
}

interface Progress {
  readonly owned: readonly TechnologyDefinition[];
  readonly pool: readonly TechnologyColor[];
}

/** Eine Technologie nach der anderen: die erste zählt schon als Voraussetzung der zweiten. */
function researchOne(
  progress: Result<Progress, DomainError>,
  id: TechnologyId,
  content: ContentPort,
): Result<Progress, DomainError> {
  if (!progress.ok) return progress;
  const { owned, pool } = progress.value;
  const technology = knownTechnology(id, owned, content);
  if (!technology.ok) return technology;
  const rest = cover(pool, missingPrerequisites(owned, technology.value));
  return rest === null
    ? err(domainError('technology.prerequisites', 'Voraussetzungen fehlen', { technology: id }))
    : ok({ owned: [...owned, technology.value], pool: rest });
}

const allUsed = (progress: Progress): Check =>
  guard(progress.pool.length === 0, 'technology.unusedSpecialty', 'Spezialisierung nicht nötig');

/** Spezialisierungs-Planeten werden erschöpft (RR 80.14), danach die Technologien vermerkt. */
function researchedEvents(player: PlayerId, request: ResearchRequest): readonly GameEvent[] {
  const exhausted: readonly GameEvent[] =
    request.specialties.length > 0
      ? [{ type: 'PlanetsExhausted', player, planets: request.specialties }]
      : [];
  return [
    ...exhausted,
    ...request.technologies.map(
      (technology) => ({ type: 'TechnologyResearched', player, technology }) as const,
    ),
  ];
}

/**
 * Pure Fabrication für jedes Erforschen (Technologie-Karte, später Aktionskarten):
 * prüft Voraussetzungen und Spezialisierungen und liefert die Events.
 */
export function researchEvents(
  state: GameState,
  player: PlayerId,
  request: ResearchRequest,
  content: ContentPort,
): Result<readonly GameEvent[], DomainError> {
  const colors = specialtyColors(state, player, request.specialties, content);
  if (!colors.ok) return colors;
  const start = ok({ owned: ownedTechnologies(state, player, content), pool: colors.value });
  const done = request.technologies.reduce<Result<Progress, DomainError>>(
    (progress, id) => researchOne(progress, id, content),
    start,
  );
  if (!done.ok) return done;
  return andThen(allUsed(done.value), () => ok(researchedEvents(player, request)));
}
