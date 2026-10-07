import { currentActor } from '@stellar/domain';
import { useEffect } from 'react';
import { useGameStore } from './game-store.ts';

/** Kurze Pause je KI-Zug, damit Menschen die Züge auf der Karte verfolgen können. */
export const BOT_DELAY_MS = 350;

/**
 * Treibt die KI an: Ist ein Bot an der Reihe, zieht er nach einer kurzen Pause.
 * Jeder Zug ändert den Spielstand und plant so den nächsten ein.
 */
export function useBotDriver(delay = BOT_DELAY_MS): void {
  const game = useGameStore((state) => state.game);
  const bots = useGameStore((state) => state.bots);
  const error = useGameStore((state) => state.error);
  const actor = game === null ? null : currentActor(game);
  const botTurn = actor !== null && bots.includes(actor) && error?.code !== 'bot.stuck';
  useEffect(() => {
    if (!botTurn) return undefined;
    const timer = window.setTimeout(() => useGameStore.getState().botStep(), delay);
    return () => window.clearTimeout(timer);
  }, [game, botTurn, delay]);
}
