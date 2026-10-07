import type { PendingHits, SpaceCombatState, TacticalStep } from '../combat/combat-state.ts';
import type { PlayerId, SystemId } from '../shared/ids.ts';
import type { StrategyCardId } from '../strategy/strategy-card.ts';
import type { PendingTransaction } from '../transaction/goods.ts';

/** Nach einer Strategieaktion dürfen die anderen Spieler reihum die Sekundärfähigkeit nutzen. */
export interface SecondaryWindow {
  readonly card: StrategyCardId;
  readonly awaiting: readonly PlayerId[];
  /** Spieler, die die Sekundärfähigkeit ohne Strategiemarker nutzen (z. B. durch den Handel). */
  readonly free: readonly PlayerId[];
}

/** Laufende Taktikaktion (RR 79): aktiviertes System und erreichter Schritt. */
export interface TacticalActionState {
  readonly system: SystemId;
  readonly step: TacticalStep;
  /** Offene Trefferzuweisungen; solange welche offen sind, ruht der Ablauf. */
  readonly pendingHits: readonly PendingHits[];
  readonly combat: SpaceCombatState | null;
}

/** Ablauf der Aktionsphase (RR 4, RR 40). */
export interface ActionPhaseState {
  /** Initiativreihenfolge dieser Runde. */
  readonly order: readonly PlayerId[];
  readonly active: PlayerId | null;
  readonly passed: readonly PlayerId[];
  readonly secondary: SecondaryWindow | null;
  readonly tactical: TacticalActionState | null;
  /** Offenes Tauschangebot des aktiven Spielers (RR 82). */
  readonly transaction: PendingTransaction | null;
  /** Nachbarn, mit denen der aktive Spieler in diesem Zug schon getauscht hat (RR 82.1). */
  readonly transactedWith: readonly PlayerId[];
}
