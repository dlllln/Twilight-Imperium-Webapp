import type { GameState } from '../game/game-state.ts';
import { clockwiseFrom } from '../game/game-state.ts';
import type { PlayerId, SystemId } from '../shared/ids.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import { opponentWithShips, shipsOf, spaceCannonShooters } from './combat-queries.ts';
import type { Shooter } from './dice.ts';

/** Wer mit welchen Weltraumkanonen auf wen feuern kann. */
export interface CannonPlan {
  readonly player: PlayerId;
  readonly target: PlayerId;
  readonly shooters: readonly Shooter[];
}

/** RR 87.6: Der aktive Spieler zielt auf seinen Gegner, alle anderen auf den aktiven Spieler. */
function cannonTarget(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  active: PlayerId,
  catalog: UnitCatalog,
): PlayerId | null {
  if (player === active) return opponentWithShips(state, system, active, catalog);
  return shipsOf(state, system, active, catalog).length > 0 ? active : null;
}

/** RR 87.3: Reihum ab dem aktiven Spieler alle Weltraumkanonen in Reichweite mit Ziel. */
export function cannonPlans(
  state: GameState,
  system: SystemId,
  active: PlayerId,
  catalog: UnitCatalog,
): readonly CannonPlan[] {
  return clockwiseFrom(state, active).flatMap((player): CannonPlan[] => {
    const target = cannonTarget(state, system, player.id, active, catalog);
    const shooters = spaceCannonShooters(state, system, player.id, catalog);
    return target === null || shooters.length === 0
      ? []
      : [{ player: player.id, target, shooters }];
  });
}
