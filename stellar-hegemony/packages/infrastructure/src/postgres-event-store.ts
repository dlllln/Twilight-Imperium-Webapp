import type { EventStorePort } from '@stellar/application';
import {
  type DomainError,
  domainError,
  err,
  type GameEvent,
  type GameId,
  ok,
  type Result,
} from '@stellar/domain';
import pg from 'pg';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS game_events (
    game_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    event JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, version)
  )`;

/*
 * Anhängen nur, wenn genau `expectedVersion` Events existieren (optimistische Sperre).
 * Schreibt ein anderer gleichzeitig, scheitert einer an der Prüfung oder am Primärschlüssel.
 */
const APPEND = `
  INSERT INTO game_events (game_id, version, event)
  SELECT $1, $2 + item.position, item.event
  FROM jsonb_array_elements($3::jsonb) WITH ORDINALITY AS item(event, position)
  WHERE (SELECT count(*) FROM game_events WHERE game_id = $1) = $2`;

const LOAD = 'SELECT event FROM game_events WHERE game_id = $1 ORDER BY version';

const UNIQUE_VIOLATION = '23505';

const conflict = (expectedVersion: number): DomainError =>
  domainError('store.versionConflict', 'Partie wurde zwischenzeitlich verändert', {
    expectedVersion,
  });

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;

/** Event Store in PostgreSQL: eine Zeile je Event, die Partie entsteht durch Replay. */
export class PostgresEventStore implements EventStorePort {
  private constructor(private readonly pool: pg.Pool) {}

  static async connect(connectionString: string): Promise<PostgresEventStore> {
    const pool = new pg.Pool({ connectionString });
    await pool.query(SCHEMA);
    return new PostgresEventStore(pool);
  }

  async load(gameId: GameId): Promise<readonly GameEvent[]> {
    const result = await this.pool.query<{ event: GameEvent }>(LOAD, [gameId]);
    return result.rows.map((row) => row.event);
  }

  async append(
    gameId: GameId,
    expectedVersion: number,
    events: readonly GameEvent[],
  ): Promise<Result<number, DomainError>> {
    try {
      const params = [gameId, expectedVersion, JSON.stringify(events)];
      const result = await this.pool.query(APPEND, params);
      return result.rowCount === events.length
        ? ok(expectedVersion + events.length)
        : err(conflict(expectedVersion));
    } catch (error) {
      if (isUniqueViolation(error)) return err(conflict(expectedVersion));
      throw error;
    }
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
