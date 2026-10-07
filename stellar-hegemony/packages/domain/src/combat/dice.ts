import { type RandomPort, rollDice } from '../ports/random-port.ts';
import type { PlayerId, UnitId, UnitTypeId } from '../shared/ids.ts';
import type { CombatProfile } from '../unit/unit-definition.ts';
import type { Unit } from '../unit/unit.ts';

/** Würfe einer Einheit: Treffer bei jedem Ergebnis ≥ `hitOn` (RR 44, RR 63.5). */
export interface UnitRoll {
  readonly unit: UnitId;
  readonly type: UnitTypeId;
  readonly hitOn: number;
  readonly results: readonly number[];
}

/** Alle Würfe eines Spielers gegen einen Gegner in einem Schritt. */
export interface Volley {
  readonly player: PlayerId;
  readonly target: PlayerId;
  readonly rolls: readonly UnitRoll[];
  readonly hits: number;
}

export interface Shooter {
  readonly unit: Unit;
  readonly profile: CombatProfile;
}

export const hitsOf = (rolls: readonly UnitRoll[]): number =>
  rolls.reduce((sum, roll) => sum + roll.results.filter((r) => r >= roll.hitOn).length, 0);

/** RR 63.5: Einheiten mit niedrigerem Kampfwert würfeln zuerst. */
export function rollVolley(
  random: RandomPort,
  sides: number,
  shooters: readonly Shooter[],
  players: { readonly player: PlayerId; readonly target: PlayerId },
): Volley {
  const ordered = [...shooters].sort((a, b) => a.profile.hitOn - b.profile.hitOn);
  const rolls = ordered.map(({ unit, profile }) => ({
    unit: unit.id,
    type: unit.type,
    hitOn: profile.hitOn,
    results: rollDice(random, sides, profile.dice),
  }));
  return { ...players, rolls, hits: hitsOf(rolls) };
}
