import type { Lobby, LobbyStorePort } from '@stellar/application';
import { Redis } from 'ioredis';

const DAY_SECONDS = 86_400;
/** Eine Lobby lebt zwei Wochen nach der letzten Änderung; die Partie selbst bleibt im Event Store. */
const TTL_SECONDS = 14 * DAY_SECONDS;

const keyOf = (code: string): string => `stellar:lobby:${code}`;

/** Lobbys in Redis: überstehen einen Neustart des Servers und laufen von selbst ab. */
export class RedisLobbyStore implements LobbyStorePort {
  private constructor(private readonly redis: Redis) {}

  static connect(url: string): RedisLobbyStore {
    return new RedisLobbyStore(new Redis(url, { lazyConnect: false }));
  }

  async load(code: string): Promise<Lobby | null> {
    const json = await this.redis.get(keyOf(code));
    return json === null ? null : (JSON.parse(json) as Lobby);
  }

  async save(lobby: Lobby): Promise<void> {
    await this.redis.set(keyOf(lobby.code), JSON.stringify(lobby), 'EX', TTL_SECONDS);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
