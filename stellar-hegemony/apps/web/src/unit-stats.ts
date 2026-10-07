import { type GameState, technologyCatalog, type UnitCatalog } from '@stellar/domain';
import { content } from './store.ts';

/** Einheitenwerte dieses Spielstands: Grundwerte plus Technologien ihrer Besitzer. */
export const unitsOf = (game: GameState): UnitCatalog => technologyCatalog(game, content);
