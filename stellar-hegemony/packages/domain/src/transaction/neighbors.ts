import { areSystemsAdjacent } from '../galaxy/adjacency.ts';
import type { SystemState } from '../galaxy/system-state.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlayerId } from '../shared/ids.ts';

/** RR 55: Systeme, in denen ein Spieler Einheiten hat oder einen Planeten kontrolliert. */
export function presenceOf(state: GameState, player: PlayerId): readonly SystemState[] {
  return Object.values(state.systems).filter(
    (system) =>
      system.spaceUnits.some((unit) => unit.owner === player) ||
      system.planetIds.some((id) => {
        const planet = state.planets[id];
        return planet?.controller === player || planet?.units.some((u) => u.owner === player);
      }),
  );
}

/** RR 55: Nachbarn teilen ein System oder haben Präsenz in angrenzenden Systemen. */
export function areNeighbors(state: GameState, a: PlayerId, b: PlayerId): boolean {
  if (a === b) return false;
  const theirs = presenceOf(state, b);
  return presenceOf(state, a).some((mine) =>
    theirs.some((other) => other.id === mine.id || areSystemsAdjacent(mine, other)),
  );
}

export const neighborsOf = (state: GameState, player: PlayerId): readonly PlayerId[] =>
  state.players.map((p) => p.id).filter((id) => areNeighbors(state, player, id));
