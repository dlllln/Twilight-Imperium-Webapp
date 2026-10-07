import { afterAll, describe, expect, it } from 'vitest';
import { gameId, type GameEvent, playerId } from '@stellar/domain';
import { BASE_RULE_NUMBERS } from '@stellar/content';
import { PostgresEventStore, RedisLobbyStore } from '../src/node.ts';

/*
 * Laufen gegen echte Dienste, sobald DATABASE_URL bzw. REDIS_URL gesetzt sind
 * (in der CI als Service-Container, lokal z. B. mit Docker).
 */
const DATABASE_URL = process.env['DATABASE_URL'];
const REDIS_URL = process.env['REDIS_URL'];

const created = (id: string): GameEvent => ({
  type: 'GameCreated',
  gameId: gameId(id),
  host: playerId('h'),
  config: { playerCount: 3, victoryPointsToWin: 10, rules: BASE_RULE_NUMBERS },
});

const unique = (prefix: string): string => `${prefix}-${globalThis.crypto.randomUUID()}`;

describe.runIf(DATABASE_URL !== undefined)('PostgresEventStore', () => {
  const connecting = PostgresEventStore.connect(DATABASE_URL ?? '');
  afterAll(async () => (await connecting).close());

  it('speichert Events in Reihenfolge und lädt sie unverändert', async () => {
    const store = await connecting;
    const id = gameId(unique('pg'));
    const events = [created(id), { type: 'GameStarted' } as unknown as GameEvent];
    expect(await store.append(id, 0, events)).toEqual({ ok: true, value: 2 });
    expect(await store.load(id)).toEqual(events);
  });

  it('optimistische Sperre: veraltete Version und gleichzeitiges Schreiben scheitern', async () => {
    const store = await connecting;
    const id = gameId(unique('pg'));
    await store.append(id, 0, [created(id)]);
    const stale = await store.append(id, 0, [created(id)]);
    expect(stale.ok ? null : stale.error.code).toBe('store.versionConflict');
    const both = await Promise.all([
      store.append(id, 1, [created(id)]),
      store.append(id, 1, [created(id)]),
    ]);
    expect(both.filter((result) => result.ok)).toHaveLength(1);
    expect(await store.load(id)).toHaveLength(2);
  });
});

describe.runIf(REDIS_URL !== undefined)('RedisLobbyStore', () => {
  const store = RedisLobbyStore.connect(REDIS_URL ?? '');
  afterAll(() => store.close());

  it('speichert Lobbys und lädt sie nach einem Neustart wieder', async () => {
    const code = unique('lobby');
    const lobby = { code, gameId: gameId('g'), mapString: 'x', seats: [], started: true };
    expect(await store.load(code)).toBeNull();
    await store.save(lobby);
    expect(await store.load(code)).toEqual(lobby);
  });
});
