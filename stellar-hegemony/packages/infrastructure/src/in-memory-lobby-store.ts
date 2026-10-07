import type { Lobby, LobbyStorePort } from '@stellar/application';

/** Lobbys im Speicher: für Tests und für einen Server ohne Redis. */
export class InMemoryLobbyStore implements LobbyStorePort {
  private readonly lobbies = new Map<string, Lobby>();

  load(code: string): Promise<Lobby | null> {
    return Promise.resolve(this.lobbies.get(code) ?? null);
  }

  save(lobby: Lobby): Promise<void> {
    this.lobbies.set(lobby.code, lobby);
    return Promise.resolve();
  }
}
