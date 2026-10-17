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

export interface ChooseFactionRequest {
  readonly faction: string;
}

/** Antwort auf einen Command: neue Version und ob man diesen Schritt noch zurücknehmen kann. */
export interface CommandReceipt {
  readonly version: number;
  readonly undoable: boolean;
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

/** Flüchtiges Zeigen am Tisch, ohne Änderung am Spielstand oder an geheimen Informationen. */
export interface MapPingRequest {
  readonly code: string;
  readonly system: string;
}

export interface MapPing {
  readonly id: string;
  readonly code: string;
  readonly system: string;
  /** Lobby-Sitz ist nullbasiert; Darstellung verwendet `seat + 1`. */
  readonly seat: number;
  readonly player: PlayerId;
  readonly name: string;
  readonly lifetimeMs: number;
}

export type Ack<T> = (result: Result<T, DomainError>) => void;

/** Nachrichten vom Browser an den Server (Socket.IO). */
export interface ClientToServer {
  'lobby:create': (request: CreateLobbyRequest, ack: Ack<SeatTicket>) => void;
  'lobby:join': (request: JoinLobbyRequest, ack: Ack<SeatTicket>) => void;
  'lobby:resume': (ticket: Pick<SeatTicket, 'code' | 'token'>, ack: Ack<SeatTicket>) => void;
  'lobby:start': (request: Record<string, never>, ack: Ack<LobbyView>) => void;
  'lobby:faction': (request: ChooseFactionRequest, ack: Ack<LobbyView>) => void;
  'game:command': (command: GameCommand, ack: Ack<CommandReceipt>) => void;
  /** Nimmt den letzten eigenen Schritt zurück, solange niemand sonst etwas getan hat. */
  'game:undo': (request: Record<string, never>, ack: Ack<number>) => void;
  'map:ping': (request: MapPingRequest, ack: Ack<MapPing>) => void;
}

/** Nachrichten vom Server an alle Browser einer Lobby. */
export interface ServerToClient {
  'lobby:update': (view: LobbyView) => void;
  'game:update': (update: GameUpdate) => void;
  'map:ping': (ping: MapPing) => void;
}
