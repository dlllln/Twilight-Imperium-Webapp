import type { RoundStats, SecretChoice } from '../objective/objective-state.ts';
import type {
  ActionCardId,
  FactionId,
  ObjectiveId,
  PlayerId,
  TechnologyId,
} from '../shared/ids.ts';
import type { FactionRules } from '../faction/faction-ability.ts';
import type { FragmentKind } from '../exploration/exploration-definition.ts';
import type { OwnedRelic } from '../exploration/exploration-state.ts';
import type { OwnedLeader } from '../leaders/leader-state.ts';
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
  /** Geheime Hand (RR 3.5); gleichnamige Karten können mehrfach vorkommen. */
  readonly actionCards: readonly ActionCardId[];
  /** Mitgezählt für Aufträge, die sich auf diese Runde beziehen. */
  readonly roundStats: RoundStats;
  /** Abweichungen der Fraktion von den allgemeinen Regeln (ab Spielstart). */
  readonly factionRules: FactionRules;
  /** PoK Relikt: offen gehaltene Reliktfragmente. */
  readonly relicFragments: readonly FragmentKind[];
  /** PoK Relikt: offen gehaltene Relikte. */
  readonly relics: readonly OwnedRelic[];
  /** PoK Anführer: Agent, Kommandant und Held der Fraktion mit offenem Zustand. */
  readonly leaders: readonly OwnedLeader[];
}
