import type { DomainError, GameEvent, GameId, Result } from '@stellar/domain';

/**
 * Port zum Event Store (Dependency Inversion). Adapter: In-Memory (Tests),
 * PostgreSQL (Iteration 12).
 */
export interface EventStorePort {
  load(gameId: GameId): Promise<readonly GameEvent[]>;
  /** Optimistische Sperre: schlägt fehl, wenn bereits mehr als `expectedVersion` Events existieren. */
  append(
    gameId: GameId,
    expectedVersion: number,
    events: readonly GameEvent[],
  ): Promise<Result<number, DomainError>>;
}
