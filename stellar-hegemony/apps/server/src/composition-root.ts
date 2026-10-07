import {
  type EventStorePort,
  GameController,
  type LobbyStorePort,
  OnlineGames,
} from '@stellar/application';
import { heuristicBot } from '@stellar/bots';
import { BASE_RULE_NUMBERS, createBaseContent } from '@stellar/content';
import {
  CryptoIds,
  CryptoRandom,
  InMemoryEventStore,
  InMemoryLobbyStore,
  InProcessEventPublisher,
  SystemClock,
} from '@stellar/infrastructure';
import { PostgresEventStore, RedisLobbyStore } from '@stellar/infrastructure/node';
import type { ServerConfig } from './config.ts';

const VICTORY_POINTS = 10;

export interface Services {
  readonly online: OnlineGames;
  readonly publisher: InProcessEventPublisher;
  readonly storage: string;
  close(): Promise<void>;
}

interface Closable {
  close(): Promise<void>;
}

async function eventStore(config: ServerConfig): Promise<EventStorePort & Partial<Closable>> {
  return config.databaseUrl === null
    ? new InMemoryEventStore()
    : PostgresEventStore.connect(config.databaseUrl);
}

const lobbyStore = (config: ServerConfig): LobbyStorePort & Partial<Closable> =>
  config.redisUrl === null ? new InMemoryLobbyStore() : RedisLobbyStore.connect(config.redisUrl);

const storageLabel = (config: ServerConfig): string =>
  [
    config.databaseUrl === null ? 'Speicher' : 'PostgreSQL',
    config.redisUrl === null ? 'Speicher' : 'Redis',
  ].join(' / ');

const gameController = (store: EventStorePort, publisher: InProcessEventPublisher) =>
  new GameController({
    store,
    publisher,
    random: new CryptoRandom(),
    clock: new SystemClock(),
    content: createBaseContent(),
  });

/** Composition Root: hier und nur hier werden Adapter mit den Anwendungsfällen verdrahtet. */
export async function compose(config: ServerConfig): Promise<Services> {
  const store = await eventStore(config);
  const lobbies = lobbyStore(config);
  const publisher = new InProcessEventPublisher();
  const games = gameController(store, publisher);
  const table = { rules: BASE_RULE_NUMBERS, victoryPointsToWin: VICTORY_POINTS };
  const ids = new CryptoIds();
  const online = new OnlineGames({ lobbies, ids, games, bot: heuristicBot, table });
  const close = async () => {
    await Promise.all([store.close?.(), lobbies.close?.()]);
  };
  return { online, publisher, storage: storageLabel(config), close };
}
