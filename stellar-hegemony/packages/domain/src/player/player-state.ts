import type { RoundStats, SecretChoice } from '../objective/objective-state.ts';
import type { FactionId, ObjectiveId, PlayerId, TechnologyId } from '../shared/ids.ts';
import type { PoolCounts } from './command-sheet.ts';

export type PlayerColor =
  'black' | 'blue' | 'green' | 'orange' | 'pink' | 'purple' | 'red' | 'yellow';

/** Zustand eines Spielers. Serialisierbar, damit Event-Replay und Views einfach bleiben. */
export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: PlayerColor;
  readonly faction: FactionId;
  /** Sitzplatz im Uhrzeigersinn, 0-basiert. */
  readonly seat: number;
  readonly commandPools: PoolCounts;
  /** Kommandomarker im persönlichen Nachschub (weder auf Tafel noch auf dem Plan). */
  readonly reinforcementTokens: number;
  readonly tradeGoods: number;
  readonly commodities: number;
  readonly commodityLimit: number;
  readonly technologies: readonly TechnologyId[];
  readonly victoryPoints: number;
  /** Geheime Aufträge des Spielers, gewertete eingeschlossen (RR 37.4). */
  readonly secretObjectives: readonly ObjectiveId[];
  readonly secretChoice: SecretChoice | null;
  /** Mitgezählt für Aufträge, die sich auf diese Runde beziehen. */
  readonly roundStats: RoundStats;
}
