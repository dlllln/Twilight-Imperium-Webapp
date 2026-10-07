import type { EventPublisherPort } from '@stellar/application';
import type { GameEvent, GameId, GameState } from '@stellar/domain';

export type EventListener = (
  gameId: GameId,
  events: readonly GameEvent[],
  state: GameState,
) => void;

/** Einfacher Observer: verteilt gespeicherte Events an registrierte Listener. */
export class InProcessEventPublisher implements EventPublisherPort {
  private readonly listeners = new Set<EventListener>();

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(gameId: GameId, events: readonly GameEvent[], state: GameState): void {
    for (const listener of this.listeners) listener(gameId, events, state);
  }
}
