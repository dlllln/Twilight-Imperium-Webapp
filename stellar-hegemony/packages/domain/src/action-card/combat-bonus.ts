import type { Shooter } from '../combat/dice.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import { MIN_HIT_ON } from '../technology/unit-modifiers.ts';
import type { CombatBonus } from './action-card-state.ts';

/** Summe der Kartenboni eines Spielers für Raumkampfrunde `round` oder den Bodenkampf. */
export function bonusFor(
  state: GameState,
  player: PlayerId,
  kind: CombatBonus['kind'],
  round: number | null,
): number {
  const bonuses = state.actionPhase?.tactical?.bonuses ?? [];
  return bonuses
    .filter((bonus) => bonus.player === player && bonus.kind === kind && bonus.round === round)
    .reduce((sum, bonus) => sum + bonus.amount, 0);
}

/** +1 auf Kampfwürfe heißt: jeder Würfel trifft schon eine Stufe früher (mindestens 1). */
export const boosted = (shooters: readonly Shooter[], amount: number): readonly Shooter[] =>
  shooters.map((shooter) => ({
    ...shooter,
    profile: { ...shooter.profile, hitOn: Math.max(MIN_HIT_ON, shooter.profile.hitOn - amount) },
  }));
