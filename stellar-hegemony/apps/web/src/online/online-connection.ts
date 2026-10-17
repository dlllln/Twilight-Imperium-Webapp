import type {
  ClientToServer,
  CommandReceipt,
  CreateLobbyRequest,
  GameUpdate,
  JoinLobbyRequest,
  LobbyView,
  MapPing,
  MapPingRequest,
  SeatTicket,
  ServerToClient,
} from '@stellar/application';
import type { DomainError, GameCommand, Result } from '@stellar/domain';
import { io, type Socket } from 'socket.io-client';

type Reply<T> = Promise<Result<T, DomainError>>;

/** Port zum Server (Dependency Inversion): Tests ersetzen ihn durch eine Attrappe. */
export interface OnlineConnection {
  create(request: CreateLobbyRequest): Reply<SeatTicket>;
  join(request: JoinLobbyRequest): Reply<SeatTicket>;
  resume(ticket: Pick<SeatTicket, 'code' | 'token'>): Reply<SeatTicket>;
  start(): Reply<LobbyView>;
  faction(faction: string): Reply<LobbyView>;
  command(command: GameCommand): Reply<CommandReceipt>;
  undo(): Reply<number>;
  ping?(request: MapPingRequest): Reply<MapPing>;
  close(): void;
}

/** Was der Server von sich aus meldet. */
export interface ConnectionEvents {
  lobby(view: LobbyView): void;
  game(update: GameUpdate): void;
  ping?(ping: MapPing): void;
  connected(): void;
  disconnected(): void;
}

export type Connector = (events: ConnectionEvents) => OnlineConnection;

const TIMEOUT_MS = 10_000;
const UNREACHABLE: Result<never, DomainError> = {
  ok: false,
  error: { code: 'server.unreachable', message: 'Der Server ist nicht erreichbar' },
};

/** Ohne Antwort in angemessener Zeit gilt der Server als nicht erreichbar. */
function ask<T>(
  socket: Socket<ServerToClient, ClientToServer>,
  send: (timed: typeof socket) => Promise<Result<T, DomainError>>,
): Reply<T> {
  return send(socket.timeout(TIMEOUT_MS) as typeof socket).catch(() => UNREACHABLE);
}

/** Socket.IO-Adapter; ohne `VITE_SERVER_URL` spricht er mit dem Server, der die Seite ausliefert. */
export const socketConnector: Connector = (events) => {
  const url = import.meta.env['VITE_SERVER_URL'] as string | undefined;
  const socket: Socket<ServerToClient, ClientToServer> = url === undefined ? io() : io(url);
  socket.on('connect', () => events.connected());
  socket.on('disconnect', () => events.disconnected());
  socket.on('lobby:update', (view) => events.lobby(view));
  socket.on('game:update', (update) => events.game(update));
  socket.on('map:ping', (ping) => events.ping?.(ping));
  return {
    create: (request) => ask(socket, (s) => s.emitWithAck('lobby:create', request)),
    join: (request) => ask(socket, (s) => s.emitWithAck('lobby:join', request)),
    resume: (ticket) => ask(socket, (s) => s.emitWithAck('lobby:resume', ticket)),
    start: () => ask(socket, (s) => s.emitWithAck('lobby:start', {})),
    faction: (faction) => ask(socket, (s) => s.emitWithAck('lobby:faction', { faction })),
    command: (command) => ask(socket, (s) => s.emitWithAck('game:command', command)),
    undo: () => ask(socket, (s) => s.emitWithAck('game:undo', {})),
    ping: (request) => ask(socket, (s) => s.emitWithAck('map:ping', request)),
    close: () => socket.disconnect(),
  };
};
