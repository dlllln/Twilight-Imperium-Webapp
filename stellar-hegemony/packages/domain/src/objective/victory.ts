import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';

const winnerAfter = (state: GameState) =>
  state.winner === null
    ? state.players.find((player) => player.victoryPoints >= state.config.victoryPointsToWin)
    : undefined;

/**
 * RR 68.7: Die Partie endet sofort, sobald jemand das Siegpunktziel erreicht. Nach dem
 * entscheidenden Event folgt `GameWon`, alles Spätere entfällt (Decorator um jeden Handler).
 */
export function withVictory(state: GameState, events: readonly GameEvent[]): readonly GameEvent[] {
  let current = state;
  for (const [index, event] of events.entries()) {
    current = evolveGame(current, event);
    const winner = winnerAfter(current);
    if (winner !== undefined)
      return [...events.slice(0, index + 1), { type: 'GameWon', player: winner.id }];
  }
  return events;
}
