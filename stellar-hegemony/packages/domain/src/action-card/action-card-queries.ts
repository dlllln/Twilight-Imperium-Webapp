import { findPlayer, type GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { ActionCardDefinition } from './action-card-definition.ts';
import { effectUsable, situation, targetOptions } from './card-effects.ts';
import { findActionCard, timingOpen } from './card-timing.ts';
import type { TargetOptions } from './effect-rule.ts';

/** Eine Karte der Hand aus Sicht des Clients: Anzahl, jetzt spielbar und mögliche Ziele. */
export interface HandCard {
  readonly definition: ActionCardDefinition;
  readonly count: number;
  readonly playable: boolean;
  readonly targets: TargetOptions;
}

/** Wer im offenen Zeitfenster oder beim Verhindern gerade entscheidet. */
export const reactionActor = (state: GameState): PlayerId | null =>
  state.pendingPlay?.awaiting[0] ?? state.reactionWindow?.awaiting[0] ?? null;

/** Information Expert für Clients: die Hand mit derselben Prüfung wie `PlayActionCard`. */
export function handCards(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): readonly HandCard[] {
  const hand = findPlayer(state, player)?.actionCards ?? [];
  return [...new Set(hand)].flatMap((id) => {
    const definition = findActionCard(content, id);
    if (definition === undefined) return [];
    const input = situation(state, player, definition.effect, content);
    const repeated = state.reactionWindow?.played.some(
      (entry) => entry.player === player && entry.card === id,
    );
    const playable =
      timingOpen(state, player, definition.timing) && repeated !== true && effectUsable(input);
    const count = hand.filter((card) => card === id).length;
    return [{ definition, count, playable, targets: targetOptions(input) }];
  });
}
