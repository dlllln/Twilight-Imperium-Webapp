import type {
  ClientToServer,
  GameUpdate,
  LobbyView,
  SeatTicket,
  ServerToClient,
} from '@stellar/application';
import { createBaseContent } from '@stellar/content';
import { formatMapString, generateGalaxyLayout, type Result } from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { compose } from '../src/composition-root.ts';
import { readConfig } from '../src/config.ts';
import { buildServer, type RunningServer } from '../src/http-server.ts';

export type Client = Socket<ServerToClient, ClientToServer>;

const content = createBaseContent();

export function mapFor(playerCount: number): string {
  const template = content.galaxyTemplate(playerCount);
  if (template === undefined) throw new Error('Keine Vorlage');
  const layout = generateGalaxyLayout(template, content.tiles, new SeededRandom(3));
  if (!layout.ok) throw new Error(layout.error.code);
  return formatMapString(layout.value);
}

export async function startServer(env: Record<string, string> = {}) {
  const config = readConfig({ PORT: '0', BOT_DELAY_MS: '0', LOG_LEVEL: 'silent', ...env });
  const server: RunningServer = await buildServer(config, await compose(config));
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const { port } = server.app.server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${String(port)}` };
}

export const connect = (url: string): Client =>
  io(url, { transports: ['websocket'], forceNew: true, reconnection: false });

/** Wartet auf die erste Nachricht, die die Bedingung erfüllt. */
export function next<K extends 'lobby:update' | 'game:update'>(
  client: Client,
  event: K,
  accept: (payload: K extends 'lobby:update' ? LobbyView : GameUpdate) => boolean = () => true,
): Promise<K extends 'lobby:update' ? LobbyView : GameUpdate> {
  return new Promise((resolve) => {
    const listener = (payload: never) => {
      if (!accept(payload)) return;
      client.off(event, listener as never);
      resolve(payload);
    };
    client.on(event, listener as never);
  });
}

/** Merkt sich den letzten Spielstand eines Browsers; `until` wartet, bis er passt. */
export function tracker(client: Client) {
  let latest: GameUpdate | null = null;
  const waiting = new Set<() => void>();
  client.on('game:update', (update) => {
    latest = update;
    for (const wake of [...waiting]) wake();
  });
  const until = (accept: (update: GameUpdate) => boolean): Promise<GameUpdate> =>
    new Promise((resolve) => {
      const check = () => {
        if (latest === null || !accept(latest)) return;
        waiting.delete(check);
        resolve(latest);
      };
      waiting.add(check);
      check();
    });
  return { until };
}

export function value<T>(result: Result<T, { code: string }>): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

export async function hostAndGuest(url: string, playerCount = 3) {
  const host = connect(url);
  const guest = connect(url);
  const views = { host: tracker(host), guest: tracker(guest) };
  const request = { name: 'Anna', playerCount, mapString: mapFor(playerCount) };
  const hostTicket: SeatTicket = value(await host.emitWithAck('lobby:create', request));
  const guestSeen = next(host, 'lobby:update', (view) => view.seats[1]?.connected === true);
  const guestTicket: SeatTicket = value(
    await guest.emitWithAck('lobby:join', { code: hostTicket.code, name: 'Ben' }),
  );
  return { host, guest, hostTicket, guestTicket, guestSeen, views };
}
