import type { CommandPool } from '../player/command-sheet.ts';
import type { ActionCardId, PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import type { WindowKind } from './action-card-definition.ts';

/** Gemeinsamer Aktionsstapel und Ablagestapel (RR 3.3, RR 3.7). */
export interface ActionDeckState {
  readonly deck: readonly ActionCardId[];
  readonly discard: readonly ActionCardId[];
}

export const NO_ACTION_DECK: ActionDeckState = { deck: [], discard: [] };

/** Ziele einer Karte; welche Felder zählen, bestimmt die Wirkung. */
export interface ActionTarget {
  readonly planets?: readonly PlanetId[];
  readonly system?: SystemId;
  readonly player?: PlayerId;
  readonly pool?: CommandPool;
}

export const NO_TARGET: ActionTarget = {};

/** Geprüfte Ziele: Listen sind immer vorhanden, nicht verlangte Felder bleiben leer. */
export interface ChosenTarget {
  readonly planets: readonly PlanetId[];
  readonly systems: readonly SystemId[];
  readonly players: readonly PlayerId[];
  readonly pool: CommandPool;
}

/** Eine gespielte Karte, die erst wirkt, wenn niemand sie verhindert (RR 3.8). */
export interface PendingPlay {
  readonly player: PlayerId;
  readonly card: ActionCardId;
  readonly target: ActionTarget;
  /** Wer reihum noch verhindern darf. */
  readonly awaiting: readonly PlayerId[];
}

/** Offenes Zeitfenster: reihum spielt jeder Karten oder passt (RR 3.10). */
export interface ReactionWindow {
  readonly kind: WindowKind;
  readonly awaiting: readonly PlayerId[];
  /** In diesem Fenster schon gespielte Karten je Spieler (RR 3.6: keine gleichnamige zweimal). */
  readonly played: readonly { readonly player: PlayerId; readonly card: ActionCardId }[];
}

/** Bonus auf Kampfwürfe aus einer Karte; Raumkampf gilt für eine Runde, Bodenkampf für den Einmarsch. */
export interface CombatBonus {
  readonly player: PlayerId;
  readonly kind: 'space' | 'ground';
  readonly amount: number;
  /** Raumkampfrunde, für die der Bonus gilt; null beim Bodenkampf. */
  readonly round: number | null;
}
