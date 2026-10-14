import { type ContentPort, StaticTileCatalog, StaticUnitCatalog } from '@stellar/domain';
import { ACTION_CARDS } from './action-cards.ts';
import { AGENDAS } from './agendas.ts';
import { EXPLORATION_CARDS } from './exploration-cards.ts';
import { RELICS } from './relics.ts';
import { LEADERS } from './leaders.ts';
import { galaxyTemplate } from './galaxy-templates.ts';
import { STRATEGY_CARDS } from './strategy-cards.ts';
import { ALL_TILES, FACTIONS } from './factions.ts';
import { OBJECTIVES } from './objectives.ts';
import { TECHNOLOGIES } from './technologies.ts';
import { BASE_UNITS } from './units.ts';

/** Content-Adapter für das Grundspiel samt Erweiterung (Mechs, Erkundung, Relikte, Anführer). */
export function createBaseContent(): ContentPort {
  return {
    units: new StaticUnitCatalog(BASE_UNITS),
    tiles: new StaticTileCatalog(ALL_TILES),
    strategyCards: STRATEGY_CARDS,
    factions: FACTIONS,
    technologies: TECHNOLOGIES,
    objectives: OBJECTIVES,
    actionCards: ACTION_CARDS,
    agendas: AGENDAS,
    explorationCards: EXPLORATION_CARDS,
    relics: RELICS,
    leaders: LEADERS,
    galaxyTemplate,
  };
}
