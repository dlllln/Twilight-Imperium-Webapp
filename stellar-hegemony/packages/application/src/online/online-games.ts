import {
  andThen,
  currentActor,
  type DomainError,
  err,
  type GameCommand,
  type GameState,
  map,
  ok,
  type Result,
} from '@stellar/domain';
import type { GameController } from '../game-controller.ts';
import { createGameCommand, seatPlayerId, setupCommands, type TableSpec } from '../game-setup.ts';
import {
  botSeatsOf,
  claimSeat,
  fillWithBots,
  HOST_SEAT,
  type Lobby,
  lobbyError,
  onlineGameId,
  seatOfToken,
} from './lobby.ts';
import type { BotPort, IdGeneratorPort, LobbyStorePort } from './ports.ts';
import type { CreateLobbyRequest, JoinLobbyRequest, SeatTicket } from './protocol.ts';
import { SerialQueue } from './serial-queue.ts';
import { rehearseSetup, tableConfig, type TableRules } from './table-rules.ts';

export interface OnlineGamesPorts {
  readonly lobbies: LobbyStorePort;
  readonly ids: IdGeneratorPort;
  readonly games: GameController;
  readonly bot: BotPort;
  readonly table: TableRules;
}

type Outcome<T> = Promise<Result<T, DomainError>>;

const NAME_LIMIT = 24;
const CODE_ATTEMPTS = 5;

/** Namen kommen aus dem Browser: gekürzt, ohne Steuerzeichen, nie leer. */
export function cleanName(name: unknown): Result<string, DomainError> {
  const text = typeof name === 'string' ? name.replace(/\p{C}/gu, '').trim() : '';
  return text.length === 0
    ? err(lobbyError('name', 'Bitte einen Namen angeben'))
    : ok(text.slice(0, NAME_LIMIT));
}

const ticket = (lobby: Lobby, seat: number, token: string): SeatTicket => ({
  code: lobby.code,
  token,
  seat,
  player: seatPlayerId(seat),
});

const tableOf = (lobby: Lobby, config: TableSpec['config']): TableSpec => ({
  gameId: lobby.gameId,
  config,
  mapString: lobby.mapString,
  names: lobby.seats.map((seat) => seat.name ?? String(seat.seat + 1)),
});

/**
 * Anwendungsfälle des Online-Spiels (GRASP Controller): Lobby eröffnen, beitreten,
 * zurückkehren, starten, Commands der Spieler annehmen und die KI ziehen lassen.
 */
export class OnlineGames {
  private readonly queue = new SerialQueue();

  constructor(private readonly ports: OnlineGamesPorts) {}

  async create(request: CreateLobbyRequest): Outcome<{ lobby: Lobby; ticket: SeatTicket }> {
    const name = cleanName(request.name);
    if (!name.ok) return name;
    const code = await this.freshCode();
    if (!code.ok) return code;
    const lobby = this.newLobby(code.value, request);
    const rehearsed = this.rehearse(lobby, request.playerCount);
    if (!rehearsed.ok) return rehearsed;
    return this.claim(lobby, name.value);
  }

  async join(request: JoinLobbyRequest): Outcome<{ lobby: Lobby; ticket: SeatTicket }> {
    const name = cleanName(request.name);
    if (!name.ok) return name;
    return this.queue.run(request.code, async () => {
      const lobby = await this.lobby(request.code);
      return lobby.ok ? this.claim(lobby.value, name.value) : lobby;
    });
  }

  async resume(code: string, token: string): Outcome<{ lobby: Lobby; ticket: SeatTicket }> {
    const lobby = await this.lobby(code);
    return andThen(lobby, (found) =>
      map(seatOfToken(found, token), (seat) => ({
        lobby: found,
        ticket: ticket(found, seat, token),
      })),
    );
  }

  /** Nur der Gastgeber startet; freie Plätze übernimmt die KI. */
  async start(code: string, token: string): Outcome<Lobby> {
    return this.queue.run(code, async () => {
      const lobby = await this.lobby(code);
      if (!lobby.ok) return lobby;
      const seat = seatOfToken(lobby.value, token);
      if (!seat.ok) return seat;
      if (seat.value !== HOST_SEAT) return err(lobbyError('notHost', 'Nur der Gastgeber startet'));
      if (lobby.value.started) return err(lobbyError('started', 'Die Partie läuft bereits'));
      return this.launch(fillWithBots(lobby.value));
    });
  }

  /** Commands laufen immer im Namen des eigenen Platzes, egal was der Browser schickt. */
  async submit(code: string, token: string, command: GameCommand): Outcome<number> {
    return this.queue.run(code, async () => {
      const lobby = await this.startedLobby(code);
      if (!lobby.ok) return lobby;
      const seat = seatOfToken(lobby.value, token);
      if (!seat.ok) return seat;
      const issued = { ...command, issuedBy: seatPlayerId(seat.value) };
      const outcome = await this.ports.games.execute(lobby.value.gameId, issued);
      return map(outcome, (done) => done.state.version);
    });
  }

  /** Ein Zug der KI, falls sie an der Reihe ist; `false`, wenn ein Mensch entscheiden muss. */
  async botStep(code: string): Outcome<boolean> {
    return this.queue.run(code, async () => {
      const lobby = await this.startedLobby(code);
      if (!lobby.ok) return lobby;
      const state = await this.ports.games.load(lobby.value.gameId);
      if (!state.ok) return state;
      return this.playBot(lobby.value, state.value);
    });
  }

  async state(code: string): Outcome<GameState> {
    const lobby = await this.startedLobby(code);
    return lobby.ok ? this.ports.games.load(lobby.value.gameId) : lobby;
  }

  async lobby(code: unknown): Outcome<Lobby> {
    const found = typeof code === 'string' ? await this.ports.lobbies.load(code) : null;
    return found === null ? err(lobbyError('notFound', 'Keine Partie mit diesem Code')) : ok(found);
  }

  private async startedLobby(code: string): Outcome<Lobby> {
    const lobby = await this.lobby(code);
    if (lobby.ok && !lobby.value.started)
      return err(lobbyError('notStarted', 'Die Partie hat noch nicht begonnen'));
    return lobby;
  }

  private async playBot(lobby: Lobby, state: GameState): Outcome<boolean> {
    const actor = currentActor(state);
    const bots = botSeatsOf(lobby).map(seatPlayerId);
    if (actor === null || !bots.includes(actor)) return ok(false);
    const { games, bot } = this.ports;
    const command = bot.nextCommand(state, actor, games.context());
    if (command === null) return err(lobbyError('botStuck', 'Die KI findet keinen gültigen Zug'));
    return map(await games.execute(lobby.gameId, command), () => true);
  }

  private async freshCode(): Outcome<string> {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      const code = this.ports.ids.lobbyCode();
      if ((await this.ports.lobbies.load(code)) === null) return ok(code);
    }
    return err(lobbyError('busy', 'Kein freier Lobbycode gefunden'));
  }

  private newLobby(code: string, request: CreateLobbyRequest): Lobby {
    const count = Number.isInteger(request.playerCount) ? request.playerCount : 0;
    return {
      code,
      gameId: onlineGameId(code),
      mapString: typeof request.mapString === 'string' ? request.mapString : '',
      seats: Array.from({ length: count }, (_, seat) => ({
        seat,
        kind: 'open',
        name: null,
        token: null,
      })),
      started: false,
    };
  }

  private rehearse(lobby: Lobby, playerCount: number): Result<GameState, DomainError> {
    const config = tableConfig(this.ports.table, playerCount);
    return andThen(config, (valid) =>
      rehearseSetup(tableOf(lobby, valid), this.ports.games.context()),
    );
  }

  private async claim(lobby: Lobby, name: string): Outcome<{ lobby: Lobby; ticket: SeatTicket }> {
    const token = this.ports.ids.seatToken();
    const claimed = claimSeat(lobby, name, token);
    if (!claimed.ok) return claimed;
    await this.ports.lobbies.save(claimed.value);
    const seat = seatOfToken(claimed.value, token);
    return map(seat, (number) => ({
      lobby: claimed.value,
      ticket: ticket(claimed.value, number, token),
    }));
  }

  private async launch(lobby: Lobby): Outcome<Lobby> {
    const config = tableConfig(this.ports.table, lobby.seats.length);
    if (!config.ok) return config;
    const table = tableOf(lobby, config.value);
    const { games } = this.ports;
    let result: Result<unknown, DomainError> = await games.create(createGameCommand(table));
    for (const command of setupCommands(table, games.context().content.factions)) {
      if (!result.ok) return result;
      result = await games.execute(lobby.gameId, command);
    }
    if (!result.ok) return result;
    await this.ports.lobbies.save(lobby);
    return ok(lobby);
  }
}
