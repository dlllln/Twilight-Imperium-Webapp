import { COMMAND_POOLS } from '../player/command-sheet.ts';
import type { PlayerState } from '../player/player-state.ts';
import type { TokenSource } from './economy-events.ts';

/**
 * RR 21.2, RR 63.7: Ein Marker kommt aus dem Nachschub; ist er leer, aus dem
 * vollsten Pool der Kommandotafel (Voreinstellung, siehe REGELFRAGEN). Ohne Marker: null.
 */
export function tokenSourceOf(player: PlayerState): TokenSource | null {
  if (player.reinforcementTokens > 0) return 'reinforcements';
  const fullest = [...COMMAND_POOLS].sort(
    (a, b) => player.commandPools[b] - player.commandPools[a],
  )[0];
  return fullest !== undefined && player.commandPools[fullest] > 0 ? fullest : null;
}
