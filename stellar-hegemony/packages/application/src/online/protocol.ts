import type {
  DomainError,
  GameCommand,
  GameEvent,
  GameState,
  PlayerId,
  Result,
} from '@stellar/domain';
import type { LobbyView } from './lobby.ts';

export interface CreateLobbyRequest {
  readonly name: string;
  readonly playerCount: number;
  readonly mapString: string;
}

export interface JoinLobbyRequest {
  readonly code: string;
  readonly name: string;
}

/** Code und Schlüssel genügen, um nach einem Verbindungsabbruch auf den Platz zurückzukehren. */
export interface SeatTicket {
  readonly code: string;
  readonly token: string;
  readonly seat: number;
  readonly player: PlayerId;
}

/** Zustand und Events, wie dieser Spieler sie sehen darf (`playerView`, `visibleEvents`). */
export interface GameUpdate {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export type Ack<T> = (result: Result<T, DomainError>) => void;

/** Nachrichten vom Browser an den Server (Socket.IO). */
export interface ClientToServer {
  'lobby:create': (request: CreateLobbyRequest, ack: Ack<SeatTicket>) => void;
  'lobby:join': (request: JoinLobbyRequest, ack: Ack<SeatTicket>) => void;
  'lobby:resume': (ticket: Pick<SeatTicket, 'code' | 'token'>, ack: Ack<SeatTicket>) => void;
  'lobby:start': (request: Record<string, never>, ack: Ack<LobbyView>) => void;
  'game:command': (command: GameCommand, ack: Ack<number>) => void;
}

/** Nachrichten vom Server an alle Browser einer Lobby. */
export interface ServerToClient {
  'lobby:update': (view: LobbyView) => void;
  'game:update': (update: GameUpdate) => void;
}
