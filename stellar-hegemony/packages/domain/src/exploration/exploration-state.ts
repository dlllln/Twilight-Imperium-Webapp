import type { ExplorationCardId, PlanetId, RelicId, SystemId } from '../shared/ids.ts';
import type { ExplorationDeckKind } from './exploration-definition.ts';

export type ExplorationPiles = Readonly<Record<ExplorationDeckKind, readonly ExplorationCardId[]>>;

/** Ein Relikt in der Hand eines Spielers; erschöpfte werden in der Statusphase bereit. */
export interface OwnedRelic {
  readonly id: RelicId;
  readonly exhausted: boolean;
}

/** PoK Erkundung: Stapel, Ablagen, Grenzmarker, Depots und legendäre Marker. */
export interface ExplorationState {
  /** Verdeckte Stapel; die erste Karte liegt oben. */
  readonly decks: ExplorationPiles;
  /** Offene Ablagestapel; angelegte Karten und Fragmente landen nicht hier. */
  readonly discards: ExplorationPiles;
  readonly relicDeck: readonly RelicId[];
  /** Systeme ohne Planeten, in denen noch ein Grenzmarker liegt. */
  readonly frontierTokens: readonly SystemId[];
  /** Handelswaren-Depots je System. */
  readonly caches: Readonly<Record<string, number>>;
  /** Legendäre Planeten, deren Fähigkeit in dieser Runde genutzt wurde. */
  readonly exhaustedLegendaries: readonly PlanetId[];
}

export const NO_PILES: ExplorationPiles = {
  cultural: [],
  hazardous: [],
  industrial: [],
  frontier: [],
};

export const NO_EXPLORATION: ExplorationState = {
  decks: NO_PILES,
  discards: NO_PILES,
  relicDeck: [],
  frontierTokens: [],
  caches: {},
  exhaustedLegendaries: [],
};
