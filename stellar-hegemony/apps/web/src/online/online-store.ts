import { type LobbyView, type SeatTicket, seatPlayerId } from '@stellar/application';
import type { DomainError, GameCommand, Result } from '@stellar/domain';
import { create, type StoreApi } from 'zustand';
import { type Remote, useGameStore } from '../game-store.ts';
import {
  type ConnectionEvents,
  type Connector,
  type OnlineConnection,
  socketConnector,
} from './online-connection.ts';
import { loadName, loadTicket, saveName, saveTicket } from './saved-seat.ts';

export type OnlineStatus = 'offline' | 'connecting' | 'online' | 'reconnecting';

export interface OnlineStore {
  readonly status: OnlineStatus;
  readonly ticket: SeatTicket | null;
  readonly lobby: LobbyView | null;
  readonly error: DomainError | null;
  readonly name: string;
  readonly setName: (name: string) => void;
  /** Eröffnet eine Lobby mit der eigenen Galaxie; man sitzt selbst auf Platz 1. */
  readonly host: (playerCount: number, mapString: string) => Promise<boolean>;
  readonly join: (code: string) => Promise<boolean>;
  readonly start: () => Promise<boolean>;
  /** Eigene Fraktion in der Lobby wählen; alle sehen die Wahl sofort. */
  readonly chooseFaction: (faction: string) => Promise<boolean>;
  /** Nach einem Neuladen: zurück auf den gespeicherten Platz. */
  readonly restore: () => void;
  readonly leave: () => void;
}

type Set = StoreApi<OnlineStore>['setState'];
type Get = StoreApi<OnlineStore>['getState'];

let connector: Connector = socketConnector;
let connection: OnlineConnection | null = null;

/** Für Tests: eine Attrappe statt Socket.IO. */
export const setConnector = (next: Connector): void => {
  connection?.close();
  connection = null;
  connector = next;
};

const OFFLINE = { status: 'offline', ticket: null, lobby: null } as const;

function events(set: Set, get: Get): ConnectionEvents {
  return {
    lobby: (view) => {
      set({ lobby: view });
      const bots = view.seats.filter((seat) => seat.kind === 'bot');
      useGameStore.getState().setBots(bots.map((seat) => seatPlayerId(seat.seat)));
    },
    game: (update) => useGameStore.getState().receive(update),
    connected: () => {
      const { ticket } = get();
      if (ticket !== null) void resume(set, get, ticket);
    },
    disconnected: () => {
      if (get().ticket !== null) set({ status: 'reconnecting' });
    },
  };
}

const connect = (set: Set, get: Get): OnlineConnection => {
  connection ??= connector(events(set, get));
  return connection;
};

const reportError = (result: Result<unknown, DomainError>): void => {
  if (!result.ok) useGameStore.getState().setError(result.error);
};

/** Online-Commands: Fehler des Servers erscheinen wie Regelverstöße, Quittungen gehen an den Spielstand. */
const remote: Remote = {
  command: (command: GameCommand) => {
    void connection?.command(command).then((result) => {
      reportError(result);
      if (result.ok) useGameStore.getState().acknowledge(result.value);
    });
  },
  undo: () => {
    void connection?.undo().then(reportError);
  },
};

function seated(set: Set, ticket: SeatTicket): void {
  saveTicket(ticket);
  set({ status: 'online', ticket, error: null });
  if (useGameStore.getState().me !== ticket.player)
    useGameStore.getState().goOnline(ticket.player, remote);
}

function settle(set: Set, result: Result<SeatTicket, DomainError>): boolean {
  if (result.ok) seated(set, result.value);
  else set({ error: result.error, status: 'offline' });
  return result.ok;
}

async function resume(set: Set, get: Get, ticket: SeatTicket): Promise<void> {
  const result = await connect(set, get).resume(ticket);
  if (result.ok) {
    seated(set, result.value);
    return;
  }
  saveTicket(null);
  set({ ...OFFLINE, error: result.error });
}

const withName =
  (set: Set, get: Get, ask: (name: string) => ReturnType<OnlineConnection['join']>) =>
  async (): Promise<boolean> => {
    set({ status: 'connecting', error: null });
    saveName(get().name);
    return settle(set, await ask(get().name));
  };

async function startGame(set: Set, get: Get): Promise<boolean> {
  const result = await connect(set, get).start();
  if (!result.ok) set({ error: result.error });
  return result.ok;
}

async function pickFaction(set: Set, get: Get, faction: string): Promise<boolean> {
  const result = await connect(set, get).faction(faction);
  set({ error: result.ok ? null : result.error });
  return result.ok;
}

function restoreSeat(set: Set, get: Get): void {
  const ticket = loadTicket();
  if (ticket === null || get().ticket !== null) return;
  set({ status: 'connecting', ticket });
  connect(set, get);
}

function leaveGame(set: Set): void {
  connection?.close();
  connection = null;
  saveTicket(null);
  set({ ...OFFLINE, error: null });
  useGameStore.getState().leave();
}

export const useOnlineStore = create<OnlineStore>()((set, get) => ({
  ...OFFLINE,
  error: null,
  name: loadName(),
  setName: (name) => set({ name }),
  host: (playerCount, mapString) =>
    withName(set, get, (name) => connect(set, get).create({ name, playerCount, mapString }))(),
  join: (code) =>
    withName(set, get, (name) =>
      connect(set, get).join({ code: code.trim().toUpperCase(), name }),
    )(),
  start: () => startGame(set, get),
  chooseFaction: (faction) => pickFaction(set, get, faction),
  restore: () => restoreSeat(set, get),
  leave: () => leaveGame(set),
}));
