import type { DecisionContext, GameCommand, GameState, PlayerId } from '@stellar/domain';
import type { Lobby } from './lobby.ts';

/** Lobbys liegen in Redis (Server) oder im Speicher (Tests, ohne Redis). */
export interface LobbyStorePort {
  load(code: string): Promise<Lobby | null>;
  save(lobby: Lobby): Promise<void>;
}

/** Lobbycodes zum Weitersagen und geheime Platzschlüssel. */
export interface IdGeneratorPort {
  lobbyCode(): string;
  seatToken(): string;
}

/** Eine KI-Strategie; `@stellar/bots` liefert sie, die Anwendung kennt nur diese Schnittstelle. */
export interface BotPort {
  nextCommand(state: GameState, player: PlayerId, context: DecisionContext): GameCommand | null;
}
