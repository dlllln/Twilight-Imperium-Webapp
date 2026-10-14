import { currentPlanetDefinition } from '../economy/payment.ts';
import type { GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import { findCapability, isShip } from '../unit/unit-capabilities.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { Unit } from '../unit/unit.ts';

/** Eine Einheit mit Produktion und ihr Produktionswert (RR 62.1). */
export interface ProductionSite {
  readonly unit: Unit;
  readonly planet: PlanetId | null;
  readonly value: number;
}

function siteOf(
  state: GameState,
  content: ContentPort,
  unit: Unit,
  planet: PlanetId | null,
): readonly ProductionSite[] {
  const definition = content.units.find(unit.type, unit.owner);
  const production =
    definition === undefined ? undefined : findCapability(definition, 'production');
  if (production === undefined) return [];
  const resources =
    production.addsPlanetResources && planet !== null
      ? (currentPlanetDefinition(state, content.tiles, planet)?.resources ?? 0)
      : 0;
  return [{ unit, planet, value: production.bonus + resources }];
}

/** Alle eigenen Produktionseinheiten im System: auf Planeten und im Weltraum. */
export function productionSites(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  content: ContentPort,
): readonly ProductionSite[] {
  const systemState = state.systems[system];
  if (systemState === undefined) return [];
  const own = (unit: Unit) => unit.owner === player;
  const onPlanets = systemState.planetIds.flatMap((planet) =>
    (state.planets[planet]?.units ?? [])
      .filter(own)
      .flatMap((unit) => siteOf(state, content, unit, planet)),
  );
  const inSpace = systemState.spaceUnits
    .filter(own)
    .flatMap((unit) => siteOf(state, content, unit, null));
  return [...onPlanets, ...inSpace];
}

/** RR 62.1: Höchstzahl produzierter Einheiten im System. */
export const productionLimit = (sites: readonly ProductionSite[]): number =>
  sites.reduce((sum, site) => sum + site.value, 0);

/** RR 14: Blockiert, wenn fremde Schiffe im System sind und keine eigenen. */
export function isBlockaded(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  catalog: UnitCatalog,
): boolean {
  const ships = (state.systems[system]?.spaceUnits ?? []).filter((unit) => {
    const definition = catalog.find(unit.type, unit.owner);
    return definition !== undefined && isShip(definition);
  });
  return ships.some((ship) => ship.owner !== player) && !ships.some((s) => s.owner === player);
}
