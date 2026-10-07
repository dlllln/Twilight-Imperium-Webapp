import type { ObjectiveId, PlayerId } from '../shared/ids.ts';
import type { ObjectiveCategory, RoundStat } from './objective-definition.ts';

/** RR 12.13: Öffentliche Aufträge liegen in einer Reihe, Stufe I vor Stufe II. */
export interface PublicObjectiveSlot {
  readonly id: ObjectiveId;
  readonly stage: number;
  readonly revealed: boolean;
}

export interface ObjectivesState {
  readonly public: readonly PublicObjectiveSlot[];
  readonly secretDeck: readonly ObjectiveId[];
  /** Wer welchen Auftrag gewertet hat (öffentlich und geheim). */
  readonly scored: Readonly<Record<string, readonly PlayerId[]>>;
}

export const NO_OBJECTIVES: ObjectivesState = { public: [], secretDeck: [], scored: {} };

/** Offene Auswahl geheimer Aufträge: aus `options` bleiben genau `keep` (RR 12.20, RR 37.4). */
export interface SecretChoice {
  readonly options: readonly ObjectiveId[];
  readonly keep: number;
}

export type RoundStats = Readonly<Record<RoundStat, number>>;

export const NO_ROUND_STATS: RoundStats = {
  spaceCombatsWon: 0,
  groundCombatsWon: 0,
  shipsDestroyed: 0,
  planetsGained: 0,
};

/** Statusphase (RR 73): erst werten alle in Initiativreihenfolge, dann verteilen sie Marker. */
export interface StatusPhaseState {
  readonly step: 'scoring' | 'tokens';
  readonly order: readonly PlayerId[];
  /** Wer im laufenden Schritt noch an der Reihe ist, vorne der Nächste. */
  readonly waiting: readonly PlayerId[];
  /** RR 12.6: höchstens ein öffentlicher und ein geheimer Auftrag je Statusphase. */
  readonly scored: Readonly<Record<string, readonly ObjectiveCategory[]>>;
}
