import type { PlayerId, SystemId } from '../shared/ids.ts';
import type { StrategyCardId } from '../strategy/strategy-card.ts';

/** Nach einer Strategieaktion dürfen die anderen Spieler reihum die Sekundärfähigkeit nutzen. */
export interface SecondaryWindow {
  readonly card: StrategyCardId;
  readonly awaiting: readonly PlayerId[];
}

/** Laufende Taktikaktion (RR 79): aktiviertes System und erreichter Schritt. */
export interface TacticalActionState {
  readonly system: SystemId;
  readonly moved: boolean;
}

/** Ablauf der Aktionsphase (RR 4, RR 40). */
export interface ActionPhaseState {
  /** Initiativreihenfolge dieser Runde. */
  readonly order: readonly PlayerId[];
  readonly active: PlayerId | null;
  readonly passed: readonly PlayerId[];
  readonly secondary: SecondaryWindow | null;
  readonly tactical: TacticalActionState | null;
}
