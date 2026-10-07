import {
  type DomainError,
  domainError,
  err,
  gameId,
  type GameId,
  ok,
  type Result,
} from '@stellar/domain';

export type SeatKind = 'open' | 'human' | 'bot';

export interface LobbySeat {
  readonly seat: number;
  readonly kind: SeatKind;
  readonly name: string | null;
  /** Geheimer Schlüssel des Menschen auf diesem Platz; damit kehrt er nach einem Abbruch zurück. */
  readonly token: string | null;
}

/** Eine Online-Partie vor und nach dem Start; gespeichert im Lobby-Store. */
export interface Lobby {
  readonly code: string;
  readonly gameId: GameId;
  readonly mapString: string;
  readonly seats: readonly LobbySeat[];
  readonly started: boolean;
}

/** Was alle sehen: Plätze ohne Schlüssel, dazu wer gerade verbunden ist. */
export interface LobbyView {
  readonly code: string;
  readonly started: boolean;
  readonly seats: readonly (Omit<LobbySeat, 'token'> & { readonly connected: boolean })[];
}

export const BOT_NAME_PREFIX = 'KI';
const GAME_PREFIX = 'online-';

/** Partie und Lobby teilen sich den Code; so findet der Server zu jedem Event die Lobby. */
export const onlineGameId = (code: string): GameId => gameId(`${GAME_PREFIX}${code}`);

export const lobbyCodeOf = (game: GameId): string | null =>
  game.startsWith(GAME_PREFIX) ? game.slice(GAME_PREFIX.length) : null;
export const HOST_SEAT = 0;

export const lobbyView = (lobby: Lobby, connected: readonly number[]): LobbyView => ({
  code: lobby.code,
  started: lobby.started,
  seats: lobby.seats.map(({ seat, kind, name }) => ({
    seat,
    kind,
    name,
    connected: kind === 'bot' || connected.includes(seat),
  })),
});

export const lobbyError = (code: string, message: string): DomainError =>
  domainError(`lobby.${code}`, message);

export function seatOfToken(lobby: Lobby, token: string): Result<number, DomainError> {
  const found = lobby.seats.find((seat) => seat.token !== null && seat.token === token);
  return found === undefined ? err(lobbyError('unknownSeat', 'Unbekannter Platz')) : ok(found.seat);
}

/** Der erste freie Platz geht an den neuen Menschen. */
export function claimSeat(lobby: Lobby, name: string, token: string): Result<Lobby, DomainError> {
  if (lobby.started) return err(lobbyError('started', 'Die Partie läuft bereits'));
  const open = lobby.seats.find((seat) => seat.kind === 'open');
  if (open === undefined) return err(lobbyError('full', 'Alle Plätze sind besetzt'));
  const claimed: LobbySeat = { seat: open.seat, kind: 'human', name, token };
  return ok({ ...lobby, seats: lobby.seats.map((seat) => (seat === open ? claimed : seat)) });
}

/** Beim Start übernimmt die KI alle Plätze, die noch frei sind. */
export const fillWithBots = (lobby: Lobby): Lobby => ({
  ...lobby,
  started: true,
  seats: lobby.seats.map((seat) =>
    seat.kind === 'open'
      ? { ...seat, kind: 'bot', name: `${BOT_NAME_PREFIX}${String(seat.seat + 1)}` }
      : seat,
  ),
});

export const botSeatsOf = (lobby: Lobby): readonly number[] =>
  lobby.seats.filter((seat) => seat.kind === 'bot').map((seat) => seat.seat);
