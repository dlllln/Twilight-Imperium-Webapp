import type { GalaxyTemplate } from '../galaxy/map-layout.ts';
import type { TileCatalog } from '../galaxy/tile-catalog.ts';
import type { StrategyCardDefinition } from '../strategy/strategy-card.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';

/**
 * Zugriff der Domain auf Spieldaten (Dependency Inversion): Die Domain kennt
 * nur diese Schnittstelle, das Content-Paket liefert die Implementierung.
 */
export interface ContentPort {
  readonly units: UnitCatalog;
  readonly tiles: TileCatalog;
  readonly strategyCards: readonly StrategyCardDefinition[];
  galaxyTemplate(playerCount: number): GalaxyTemplate | undefined;
}
