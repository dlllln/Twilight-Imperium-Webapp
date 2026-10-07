import type { GameEvent, GameId } from '@stellar/domain';

/** Observer/Event-Bus zwischen Anwendung und Präsentation (Indirection). */
export interface EventPublisherPort {
  publish(gameId: GameId, events: readonly GameEvent[]): void;
}
