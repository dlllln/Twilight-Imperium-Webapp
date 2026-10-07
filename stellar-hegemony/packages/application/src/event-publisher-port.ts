import type { GameEvent, GameId, GameState } from '@stellar/domain';

/** Observer/Event-Bus zwischen Anwendung und Präsentation (Indirection). */
export interface EventPublisherPort {
  /** `state` ist der Zustand nach den Events; Empfänger müssen nichts neu berechnen. */
  publish(gameId: GameId, events: readonly GameEvent[], state: GameState): void;
}
