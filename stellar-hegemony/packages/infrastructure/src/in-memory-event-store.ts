import type { EventStorePort } from '@stellar/application';
import {
  domainError,
  err,
  type DomainError,
  type GameEvent,
  type GameId,
  ok,
  type Result,
} from '@stellar/domain';

/** Event-Store-Adapter im Speicher, für Tests, Hot-Seat und lokale Entwicklung. */
export class InMemoryEventStore implements EventStorePort {
  private readonly streams = new Map<GameId, readonly GameEvent[]>();

  load(gameId: GameId): Promise<readonly GameEvent[]> {
    return Promise.resolve(this.streams.get(gameId) ?? []);
  }

  append(
    gameId: GameId,
    expectedVersion: number,
    events: readonly GameEvent[],
  ): Promise<Result<number, DomainError>> {
    const stream = this.streams.get(gameId) ?? [];
    if (stream.length !== expectedVersion) {
      return Promise.resolve(
        err(
          domainError('store.versionConflict', 'Partie wurde zwischenzeitlich verändert', {
            expectedVersion,
            actualVersion: stream.length,
          }),
        ),
      );
    }
    const next = [...stream, ...events];
    this.streams.set(gameId, next);
    return Promise.resolve(ok(next.length));
  }
}
