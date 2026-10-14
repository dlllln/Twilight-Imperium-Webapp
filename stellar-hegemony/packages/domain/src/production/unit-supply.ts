import type { GameState } from '../game/game-state.ts';
import type { PlayerId, UnitTypeId } from '../shared/ids.ts';
import type { UnitDefinition } from '../unit/unit-definition.ts';

/** Wie viele Einheiten eines Typs ein Spieler auf dem Spielplan hat (Weltraum und Planeten). */
export function ownedOnBoard(state: GameState, player: PlayerId, type: UnitTypeId): number {
  const units = [
    ...Object.values(state.systems).flatMap((system) => system.spaceUnits),
    ...Object.values(state.planets).flatMap((planet) => planet.units),
  ];
  return units.filter((unit) => unit.owner === player && unit.type === type).length;
}

/** RR 24.5: Ob noch `count` weitere Einheiten dieses Typs im Vorrat liegen. */
export const supplyAllows = (
  state: GameState,
  player: PlayerId,
  definition: UnitDefinition,
  count: number,
): boolean =>
  definition.componentLimit === 'unlimited' ||
  ownedOnBoard(state, player, definition.id) + count <= definition.componentLimit;
