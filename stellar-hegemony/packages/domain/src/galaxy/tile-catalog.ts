import type { SystemId } from '../shared/ids.ts';
import type { SystemTile } from './system-tile.ts';

/** Lesezugriff auf alle Systemtafeln (Daten aus dem Content-Paket). */
export interface TileCatalog {
  find(id: SystemId): SystemTile | undefined;
  all(): readonly SystemTile[];
}

export class StaticTileCatalog implements TileCatalog {
  private readonly byId: ReadonlyMap<SystemId, SystemTile>;

  constructor(tiles: readonly SystemTile[]) {
    this.byId = new Map(tiles.map((tile) => [tile.id, tile]));
  }

  find(id: SystemId): SystemTile | undefined {
    return this.byId.get(id);
  }

  all(): readonly SystemTile[] {
    return [...this.byId.values()];
  }
}
