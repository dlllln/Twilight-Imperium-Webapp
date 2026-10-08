import type { HitAssignment } from '../combat/hit-assignment.ts';
import type { Volley } from '../combat/dice.ts';
import type { PlayerId, UnitId } from '../shared/ids.ts';
import type { Unit } from '../unit/unit.ts';

/*
 * Kampfsimulator: zwei Flotten kämpfen ohne Spielplan gegeneinander. Die Würfe folgen den
 * Raumkampfregeln (Jägerabwehr in Runde 1, Kampfwürfe, Schadensresistenz); dazu kommen
 * eigene Taktikkarten, von denen jede Seite je Runde eine ausspielen darf.
 */

/** Wirkung einer Taktikkarte, immer für die laufende Runde. */
export type TacticEffect =
  | { readonly kind: 'combatBonus'; readonly amount: number }
  | { readonly kind: 'cancelHits'; readonly amount: number }
  | { readonly kind: 'extraDice'; readonly amount: number }
  | { readonly kind: 'repair' };

export interface TacticCard {
  readonly id: string;
  readonly effect: TacticEffect;
}

/** Eine Seite des Kampfes: Schiffe und die noch nicht gespielten Taktikkarten. */
export interface SimSide {
  readonly player: PlayerId;
  readonly units: readonly Unit[];
  readonly hand: readonly string[];
}

/** Ergebnis offen (`null`), Sieger oder beide Flotten vernichtet (`draw`). */
export type BattleOutcome = PlayerId | 'draw' | null;

export interface SimBattle {
  readonly attacker: SimSide;
  readonly defender: SimSide;
  /** Zuletzt ausgetragene Runde, 0 vor dem ersten Schuss. */
  readonly round: number;
  readonly outcome: BattleOutcome;
}

/** Jägerabwehr einer Seite und die Jäger, die sie abgeschossen hat. */
export interface BarrageReport {
  readonly volley: Volley;
  readonly destroyed: readonly UnitId[];
}

/** Was in einer Runde geschah, in der Reihenfolge, in der die Oberfläche es zeigt. */
export interface SimRoundReport {
  readonly round: number;
  readonly played: readonly { readonly player: PlayerId; readonly card: string }[];
  readonly repaired: readonly UnitId[];
  readonly barrage: readonly BarrageReport[];
  readonly volleys: readonly Volley[];
  /** Abgewehrte Treffer je Zielspieler. */
  readonly cancelled: readonly { readonly player: PlayerId; readonly hits: number }[];
  readonly assignments: readonly (HitAssignment & { readonly player: PlayerId })[];
}

export const sidesOf = (battle: SimBattle): readonly [SimSide, SimSide] => [
  battle.attacker,
  battle.defender,
];
