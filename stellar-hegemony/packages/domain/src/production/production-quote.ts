import { findPlayer, type GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import { technologyCatalog } from '../technology/technology-catalog.ts';
import type { PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import { canBeProduced, isShip } from '../unit/unit-capabilities.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { UnitDefinition } from '../unit/unit-definition.ts';
import { type ProductionOrder, productionCost } from './production.ts';
import {
  isBlockaded,
  type ProductionSite,
  productionLimit,
  productionSites,
} from './production-queries.ts';

/** Was eine Bestellung kostet und was im System möglich ist (für Clients, ohne Würfel). */
export interface ProductionQuote {
  readonly limit: number;
  readonly count: number;
  readonly cost: number;
  readonly blockaded: boolean;
  /** Eigene Planeten mit Produktion: dorthin dürfen neue Bodentruppen. */
  readonly groundPlanets: readonly PlanetId[];
}

/** Einheiten, die der Spieler mit seinen Technologien überhaupt bauen kann (RR 62). */
export function producibleUnits(
  state: GameState,
  player: PlayerId,
  catalog: UnitCatalog,
): readonly UnitDefinition[] {
  const technologies = findPlayer(state, player)?.technologies ?? [];
  return catalog
    .all(player)
    .filter(canBeProduced)
    .filter(
      (unit) =>
        unit.requiresTechnology === undefined || technologies.includes(unit.requiresTechnology),
    );
}

/** Bekannte, baubare Bestellungen; die Kosten rechnet dieselbe Regel wie beim Command. */
const priced = (orders: readonly ProductionOrder[], catalog: UnitCatalog, player: PlayerId) =>
  orders.flatMap((order) => {
    const definition = catalog.find(order.type, player);
    return definition !== undefined && canBeProduced(definition) ? [{ order, definition }] : [];
  });

const ownSitePlanets = (
  state: GameState,
  player: PlayerId,
  sites: readonly ProductionSite[],
): readonly PlanetId[] =>
  sites.flatMap(({ planet }) =>
    planet !== null && state.planets[planet]?.controller === player ? [planet] : [],
  );

/**
 * Information Expert für die Produktionsvorschau: dieselben Abfragen wie die Regel,
 * damit Clients nichts nachbauen; Technologien gelten wie beim Command. Ob die Bestellung gilt, entscheidet weiterhin der Command.
 */
export function productionQuote(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  orders: readonly ProductionOrder[],
  base: ContentPort,
): ProductionQuote {
  const content = { ...base, units: technologyCatalog(state, base) };
  const sites = productionSites(state, system, player, content);
  const ships = priced(orders, content.units, player).some(({ definition }) => isShip(definition));
  return {
    limit: productionLimit(sites),
    count: orders.reduce((sum, order) => sum + order.count, 0),
    cost: productionCost(priced(orders, content.units, player)),
    blockaded: ships && isBlockaded(state, system, player, content.units),
    groundPlanets: ownSitePlanets(state, player, sites),
  };
}
