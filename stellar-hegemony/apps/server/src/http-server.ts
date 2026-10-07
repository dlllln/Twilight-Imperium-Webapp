import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { resolve } from 'node:path';
import { Server } from 'socket.io';
import { BotDriver } from './bot-driver.ts';
import type { Services } from './composition-root.ts';
import type { ServerConfig } from './config.ts';
import { type GameServer, SocketGateway } from './socket-gateway.ts';

export interface RunningServer {
  readonly app: FastifyInstance;
  readonly io: GameServer;
  close(): Promise<void>;
}

/** Liefert die gebaute Web-App aus; unbekannte Pfade landen bei der Startseite. */
async function serveWeb(app: FastifyInstance, root: string): Promise<void> {
  await app.register(fastifyStatic, { root: resolve(root), wildcard: false });
  app.setNotFoundHandler((_, reply) => reply.sendFile('index.html'));
}

function attachSockets(app: FastifyInstance, config: ServerConfig, services: Services): GameServer {
  const io: GameServer = new Server(app.server, { serveClient: false });
  const log = (message: string, error: unknown) => app.log.error({ err: error }, message);
  const bots = new BotDriver(services.online, config.botDelayMs, (code, error) =>
    app.log.warn({ code, error }, 'KI-Zug fehlgeschlagen'),
  );
  new SocketGateway(io, services, bots, log).attach();
  return io;
}

/** HTTP (Fastify) und Socket.IO teilen sich einen Port. */
export async function buildServer(
  config: ServerConfig,
  services: Services,
): Promise<RunningServer> {
  const app = Fastify({ logger: { level: config.logLevel } });
  app.get('/health', () => ({ ok: true, storage: services.storage }));
  if (config.webDist !== null) await serveWeb(app, config.webDist);
  const io = attachSockets(app, config, services);
  const close = async () => {
    await io.close();
    await app.close();
    await services.close();
  };
  return { app, io, close };
}
