import type { GameState, PlayerId } from '@stellar/domain';
import { useGameStore, useViewer } from '../../game-store.ts';

/**
 * Wessen Reich die Anzeigen zeigen: online der eigene Platz, am Hot-Seat der Mensch am Zug;
 * zieht gerade die KI, bleibt der erste menschliche Platz zu sehen.
 */
export function useHudPlayer(game: GameState): PlayerId | null {
  const viewer = useViewer(game);
  const bots = useGameStore((state) => state.bots);
  const human = game.players.find((player) => !bots.includes(player.id));
  return viewer ?? human?.id ?? null;
}
