import type { ActionCardDefinition } from '../action-card/action-card-definition.ts';
import type { AgendaDefinition } from '../agenda/agenda-definition.ts';
import type {
  ExplorationCardDefinition,
  RelicDefinition,
} from '../exploration/exploration-definition.ts';
import type { FactionDefinition } from '../faction/faction-definition.ts';
import type { GalaxyTemplate } from '../galaxy/map-layout.ts';
import type { ObjectiveDefinition } from '../objective/objective-definition.ts';
import type { TileCatalog } from '../galaxy/tile-catalog.ts';
import type { StrategyCardDefinition } from '../strategy/strategy-card.ts';
import type { TechnologyDefinition } from '../technology/technology-definition.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';

/**
 * Zugriff der Domain auf Spieldaten (Dependency Inversion): Die Domain kennt
 * nur diese Schnittstelle, das Content-Paket liefert die Implementierung.
 */
export interface ContentPort {
  readonly units: UnitCatalog;
  readonly tiles: TileCatalog;
  readonly strategyCards: readonly StrategyCardDefinition[];
  readonly factions: readonly FactionDefinition[];
  readonly technologies: readonly TechnologyDefinition[];
  readonly objectives: readonly ObjectiveDefinition[];
  readonly actionCards: readonly ActionCardDefinition[];
  readonly agendas: readonly AgendaDefinition[];
  /** PoK Erkundung: alle Erkundungskarten (mit Exemplaren) und Relikte. */
  readonly explorationCards: readonly ExplorationCardDefinition[];
  readonly relics: readonly RelicDefinition[];
  galaxyTemplate(playerCount: number): GalaxyTemplate | undefined;
}
