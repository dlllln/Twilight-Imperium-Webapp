import {
  type Ack,
  type ClientToServer,
  lobbyCodeOf,
  lobbyView,
  type SeatTicket,
  seatPlayerId,
  type ServerToClient,
} from '@stellar/application';
import {
  domainError,
  err,
  type DomainError,
  type GameCommand,
  type GameEvent,
  type GameState,
  map,
  ok,
  playerView,
  type Result,
  visibleEvents,
} from '@stellar/domain';
import type { Server, Socket } from 'socket.io';
import type { BotDriver } from './bot-driver.ts';
import type { Services } from './composition-root.ts';

export interface SeatData {
  ticket?: SeatTicket;
}

export type GameServer = Server<ClientToServer, ServerToClient, Record<string, never>, SeatData>;
type GameSocket = Socket<ClientToServer, ServerToClient, Record<string, never>, SeatData>;

const failure = (code: string, message: string): Result<never, DomainError> =>
  err(domainError(code, message));

const isCommand = (value: unknown): value is GameCommand =>
  typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';

/**
 * Adapter zwischen Socket.IO und den Anwendungsfällen (Controller): übersetzt Nachrichten,
 * merkt sich den Platz jeder Verbindung und verteilt Zustände, wie jeder Spieler sie sehen darf.
 */
export class SocketGateway {
  constructor(
    private readonly io: GameServer,
    private readonly services: Services,
    private readonly bots: BotDriver,
    private readonly log: (message: string, error: unknown) => void,
  ) {}

  attach(): void {
    this.services.publisher.subscribe((game, events, state) => {
      const code = lobbyCodeOf(game);
      if (code === null) return;
      void this.broadcastGame(code, events, state);
      this.bots.kick(code);
    });
    this.io.on('connection', (socket) => this.register(socket));
  }

  private register(socket: GameSocket): void {
    this.registerLobby(socket);
    socket.on('lobby:faction', (request, ack) =>
      this.answer(ack, async () => this.faction(socket, request)),
    );
    socket.on('game:undo', (_, ack) => this.answer(ack, async () => this.undo(socket)));
    socket.on('game:command', (command, ack) =>
      this.answer(ack, async () => this.command(socket, command)),
    );
    socket.on('disconnect', () => {
      const code = socket.data.ticket?.code;
      if (code !== undefined) void this.broadcastLobby(code);
    });
  }

  private registerLobby(socket: GameSocket): void {
    const { online } = this.services;
    socket.on('lobby:create', (request, ack) =>
      this.answer(ack, async () => this.seated(socket, await online.create(request))),
    );
    socket.on('lobby:join', (request, ack) =>
      this.answer(ack, async () => this.seated(socket, await online.join(request))),
    );
    socket.on('lobby:resume', (ticket, ack) =>
      this.answer(ack, async () => this.resumed(socket, ticket)),
    );
    socket.on('lobby:start', (_, ack) => this.answer(ack, async () => this.start(socket)));
  }

  /** Fehler aus dem Browser oder der Speicherung dürfen den Server nie anhalten. */
  private answer<T>(ack: Ack<T> | undefined, task: () => Promise<Result<T, DomainError>>): void {
    const reply = typeof ack === 'function' ? ack : () => undefined;
    task().then(reply, (error: unknown) => {
      this.log('Anfrage fehlgeschlagen', error);
      reply(failure('server.error', 'Interner Fehler'));
    });
  }

  private async seated(
    socket: GameSocket,
    result: Result<{ readonly ticket: SeatTicket }, DomainError>,
  ): Promise<Result<SeatTicket, DomainError>> {
    if (!result.ok) return result;
    await this.bind(socket, result.value.ticket);
    return map(result, (value) => value.ticket);
  }

  private async resumed(
    socket: GameSocket,
    ticket: unknown,
  ): Promise<Result<SeatTicket, DomainError>> {
    const { code, token } = (ticket ?? {}) as Partial<SeatTicket>;
    if (typeof code !== 'string' || typeof token !== 'string')
      return failure('lobby.unknownSeat', 'Unbekannter Platz');
    const result = await this.seated(socket, await this.services.online.resume(code, token));
    if (result.ok) await this.sendGame(socket, code);
    return result;
  }

  private async bind(socket: GameSocket, ticket: SeatTicket): Promise<void> {
    socket.data.ticket = ticket;
    await socket.join(ticket.code);
    await this.broadcastLobby(ticket.code);
  }

  private async start(socket: GameSocket) {
    const ticket = socket.data.ticket;
    if (ticket === undefined) return failure('lobby.unknownSeat', 'Erst einer Partie beitreten');
    const started = await this.services.online.start(ticket.code, ticket.token);
    if (!started.ok) return started;
    await this.broadcastLobby(ticket.code);
    return ok(lobbyView(started.value, []));
  }

  private async faction(socket: GameSocket, request: unknown) {
    const ticket = socket.data.ticket;
    if (ticket === undefined) return failure('lobby.unknownSeat', 'Erst einer Partie beitreten');
    const { faction } = (request ?? {}) as { faction?: unknown };
    const chosen = await this.services.online.chooseFaction(ticket.code, ticket.token, faction);
    if (!chosen.ok) return chosen;
    await this.broadcastLobby(ticket.code);
    return ok(lobbyView(chosen.value, []));
  }

  private async undo(socket: GameSocket) {
    const ticket = socket.data.ticket;
    if (ticket === undefined) return failure('lobby.unknownSeat', 'Erst einer Partie beitreten');
    return this.services.online.undo(ticket.code, ticket.token);
  }

  private async command(socket: GameSocket, command: unknown) {
    const ticket = socket.data.ticket;
    if (ticket === undefined) return failure('lobby.unknownSeat', 'Erst einer Partie beitreten');
    if (!isCommand(command)) return failure('server.badCommand', 'Unbekannter Befehl');
    return this.services.online.submit(ticket.code, ticket.token, command);
  }

  /** Wer zurückkehrt, bekommt sofort den aktuellen Stand (Reconnect). */
  private async sendGame(socket: GameSocket, code: string): Promise<void> {
    const state = await this.services.online.state(code);
    if (state.ok) socket.emit('game:update', this.updateFor(socket, [], state.value));
    if (state.ok) this.bots.kick(code);
  }

  private async broadcastGame(code: string, events: readonly GameEvent[], state: GameState) {
    for (const socket of await this.io.in(code).fetchSockets())
      socket.emit('game:update', this.updateFor(socket, events, state));
  }

  private updateFor(socket: { data: SeatData }, events: readonly GameEvent[], state: GameState) {
    const seat = socket.data.ticket?.seat;
    const viewer = seat === undefined ? null : seatPlayerId(seat);
    return { state: playerView(state, viewer), events: visibleEvents(events, viewer) };
  }

  private async broadcastLobby(code: string): Promise<void> {
    const lobby = await this.services.online.lobby(code);
    if (!lobby.ok) return;
    const sockets = await this.io.in(code).fetchSockets();
    const connected = sockets.flatMap((socket) => socket.data.ticket?.seat ?? []);
    this.io.to(code).emit('lobby:update', lobbyView(lobby.value, connected));
  }
}
