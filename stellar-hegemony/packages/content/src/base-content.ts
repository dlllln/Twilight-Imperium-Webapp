import { type ContentPort, StaticTileCatalog, StaticUnitCatalog } from '@stellar/domain';
import { galaxyTemplate } from './galaxy-templates.ts';
import { STRATEGY_CARDS } from './strategy-cards.ts';
import { ALL_TILES, FACTIONS } from './factions.ts';
import { TECHNOLOGIES } from './technologies.ts';
import { BASE_UNITS } from './units.ts';

/** Content-Adapter für das Grundspiel. */
export function createBaseContent(): ContentPort {
  return {
    units: new StaticUnitCatalog(BASE_UNITS),
    tiles: new StaticTileCatalog(ALL_TILES),
    strategyCards: STRATEGY_CARDS,
    factions: FACTIONS,
    technologies: TECHNOLOGIES,
    galaxyTemplate,
  };
}
