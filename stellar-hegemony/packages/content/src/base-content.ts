import { type ContentPort, StaticTileCatalog, StaticUnitCatalog } from '@stellar/domain';
import { galaxyTemplate } from './galaxy-templates.ts';
import { ALL_TILES } from './systems.ts';
import { BASE_UNITS } from './units.ts';

/** Content-Adapter für das Grundspiel. */
export function createBaseContent(): ContentPort {
  return {
    units: new StaticUnitCatalog(BASE_UNITS),
    tiles: new StaticTileCatalog(ALL_TILES),
    galaxyTemplate,
  };
}
