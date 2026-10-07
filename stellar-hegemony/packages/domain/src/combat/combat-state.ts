import type { PlayerId, SystemId } from '../shared/ids.ts';

/** Treffer, die ein Spieler noch seinen Schiffen im aktiven System zuweisen muss (RR 89.1). */
export interface PendingHits {
  readonly player: PlayerId;
  readonly hits: number;
}

/** Angekündigter Rückzug; er findet erst am Ende der Kampfrunde statt (RR 63.5). */
export interface RetreatPlan {
  readonly player: PlayerId;
  readonly to: SystemId;
}

/** Laufender Raumkampf im aktiven System (RR 63). Angreifer ist der aktive Spieler. */
export interface SpaceCombatState {
  readonly attacker: PlayerId;
  readonly defender: PlayerId;
  readonly round: number;
  /** Wer in dieser Runde noch über einen Rückzug entscheiden muss (Verteidiger zuerst). */
  readonly awaitingRetreat: readonly PlayerId[];
  readonly retreat: RetreatPlan | null;
  /** Ob die Kampfwürfe dieser Runde schon ausgeführt wurden. */
  readonly rolled: boolean;
}

/** Schritte der Taktikaktion in Regelreihenfolge (RR 79). */
export const TACTICAL_STEPS = [
  'movement',
  'spaceCannon',
  'spaceCombat',
  'bombardment',
  'invasion',
  'production',
  'done',
] as const;

export type TacticalStep = (typeof TACTICAL_STEPS)[number];
