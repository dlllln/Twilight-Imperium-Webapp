// @vitest-environment jsdom
import type { LobbyView, SeatTicket } from '@stellar/application';
import { seatPlayerId } from '@stellar/application';
import { currentActor, type GameState, HIDDEN, playerView } from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.tsx';
import { TurnPanel } from '../src/components/game/TurnPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import type { ConnectionEvents, OnlineConnection } from '../src/online/online-connection.ts';
import { setConnector, useOnlineStore } from '../src/online/online-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { keepSecrets, started } from './game-helpers.ts';
import { leaveTable } from './local-table.ts';

const ok = <T,>(value: T) => ({ ok: true as const, value });
const failed = (code: string) => ({ ok: false as const, error: { code, message: code } });

const ticketFor = (seat: number): SeatTicket => ({
  code: 'QX7K2M',
  token: `token-${String(seat)}`,
  seat,
  player: seatPlayerId(seat),
});

const LOBBY: LobbyView = {
  code: 'QX7K2M',
  started: false,
  seats: [
    { seat: 0, kind: 'human', name: 'Anna', faction: 'nesh', connected: true },
    { seat: 1, kind: 'human', name: 'Ben', faction: null, connected: false },
    { seat: 2, kind: 'open', name: null, faction: null, connected: false },
  ],
};

/** Attrappe des Servers: zeichnet Aufrufe auf und meldet Ereignisse auf Zuruf. */
function fakeServer(seat = 0) {
  const calls: string[] = [];
  let events: ConnectionEvents | null = null;
  const connection: OnlineConnection = {
    create: (request) => (
      calls.push(`create:${request.name}`),
      Promise.resolve(ok(ticketFor(seat)))
    ),
    join: (request) =>
      request.code === 'NICHTS'
        ? Promise.resolve(failed('lobby.notFound'))
        : (calls.push(`join:${request.code}`), Promise.resolve(ok(ticketFor(seat)))),
    resume: (ticket) => (
      calls.push(`resume:${ticket.token}`),
      Promise.resolve(ok(ticketFor(seat)))
    ),
    start: () => (calls.push('start'), Promise.resolve(ok(LOBBY))),
    faction: (faction) => (calls.push(`faction:${faction}`), Promise.resolve(ok(LOBBY))),
    command: (command) => (
      calls.push(`command:${command.type}`),
      Promise.resolve(
        command.type === 'ActivateSystem'
          ? ok({ version: 999, undoable: true })
          : failed('turn.notYours'),
      )
    ),
    undo: () => (calls.push('undo'), Promise.resolve(ok(1000))),
    close: () => calls.push('close'),
  };
  setConnector((handlers) => {
    events = handlers;
    return connection;
  });
  const emit = () => {
    if (events === null) throw new Error('nicht verbunden');
    return events;
  };
  return { calls, emit };
}

const flush = () => act(() => Promise.resolve());

beforeEach(() => {
  localStorage.clear();
  useGalaxyStore.setState({ language: 'de' });
  useGameStore.getState().leave();
  useOnlineStore.setState({
    status: 'offline',
    ticket: null,
    lobby: null,
    error: null,
    name: 'Anna',
  });
});

afterEach(() => {
  cleanup();
});

describe('Online-Partie im Browser', () => {
  it('eröffnen: der Lobbycode erscheint, Plätze zeigen Verbindung und freie Plätze', async () => {
    const server = fakeServer();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Online-Partie eröffnen' }));
    await flush();
    act(() => server.emit().lobby(LOBBY));
    expect(screen.getByTestId('lobby-code').textContent).toBe('QX7K2M');
    expect(screen.getByTestId('lobby-seat-1').textContent).toContain('getrennt');
    expect(screen.getByTestId('lobby-seat-2').textContent).toContain('frei, sonst KI');
    fireEvent.click(screen.getByRole('button', { name: 'Partie starten' }));
    await flush();
    expect(server.calls).toEqual(['create:Anna', 'start']);
    expect(JSON.parse(localStorage.getItem('stellar.online.ticket') ?? '{}')).toEqual(ticketFor(0));
  });

  it('Lobby: jeder sieht die Fraktionen, wählt seine eigene auf dem eigenen Gerät', async () => {
    const server = fakeServer(1);
    render(<App />);
    await act(() => useOnlineStore.getState().join('QX7K2M'));
    act(() => server.emit().lobby(LOBBY));
    expect(screen.getByTestId('lobby-seat-1').textContent).toContain('Fraktion noch offen');
    expect(screen.getByTestId('lobby-seat-0').textContent).not.toContain('Fraktion noch offen');
    fireEvent.click(screen.getByRole('button', { name: 'Fraktion wählen' }));
    const dialog = screen.getByRole('dialog', { name: 'Fraktion wählen' });
    expect(dialog.textContent).toContain('P2 wählt eine Fraktion');
    fireEvent.click(screen.getByRole('button', { name: 'Wählen' }));
    await flush();
    expect(server.calls.some((call) => call.startsWith('faction:'))).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'Fraktion wählen' })).toBeNull();
  });

  it('beitreten: unbekannte Codes melden einen Fehler, Gäste warten auf den Gastgeber', async () => {
    const server = fakeServer(1);
    render(<App />);
    fireEvent.change(screen.getByLabelText('Lobbycode'), { target: { value: 'nichts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Beitreten' }));
    await flush();
    expect(screen.getByRole('alert').textContent).toBe('Keine Partie mit diesem Code.');
    fireEvent.change(screen.getByLabelText('Lobbycode'), { target: { value: 'qx7k2m' } });
    fireEvent.click(screen.getByRole('button', { name: 'Beitreten' }));
    await flush();
    expect(server.calls).toEqual(['join:QX7K2M']);
    expect(screen.getByText('Warte, bis der Gastgeber die Partie startet …')).toBeTruthy();
  });

  it('der Server liefert die eigene Sicht; Commands gehen an ihn, Fehler kommen zurück', async () => {
    const server = fakeServer(1);
    await act(() => useOnlineStore.getState().join('QX7K2M'));
    const game = started();
    act(() => server.emit().game({ state: playerView(game, seatPlayerId(1)), events: [] }));
    const mine = useGameStore.getState().game as GameState;
    expect(mine.players[1]?.secretChoice?.options).not.toContain(HIDDEN);
    expect(mine.players[0]?.secretChoice?.options).toContain(HIDDEN);
    expect(useGameStore.getState().send({ type: 'Pass', issuedBy: seatPlayerId(1) })).toBe(true);
    await flush();
    expect(server.calls).toContain('command:Pass');
    expect(useGameStore.getState().error?.code).toBe('turn.notYours');
  });

  it('Rückgängig: nach einem zurücknehmbaren Schritt bittet der Knopf den Server um Rücknahme', async () => {
    const game = keepSecrets(started());
    leaveTable();
    const server = fakeServer(0);
    await act(() => useOnlineStore.getState().join('QX7K2M'));
    const mine = { ...game, version: 999 };
    act(() => server.emit().game({ state: mine, events: [] }));
    const me = seatPlayerId(0);
    act(() => useGameStore.setState({ game: { ...mine, pickQueue: [me] } }));
    useGameStore.getState().send({ type: 'ActivateSystem', issuedBy: me, system: 'x' as never });
    await flush();
    expect(useGameStore.getState().undoVersion).toBe(999);
    useGameStore.getState().undo();
    await flush();
    expect(server.calls).toContain('undo');
    expect(useGameStore.getState().undoVersion).toBeNull();
  });

  it('ist ein Mitspieler dran, zeigt das Zugfeld nur, wer gerade überlegt', async () => {
    const game = keepSecrets(started());
    leaveTable();
    const server = fakeServer(2);
    await act(() => useOnlineStore.getState().join('QX7K2M'));
    act(() => server.emit().game({ state: game, events: [] }));
    expect(currentActor(game)).not.toBe(seatPlayerId(2));
    render(<TurnPanel game={game} />);
    expect(screen.getByText('ist am Zug …')).toBeTruthy();
  });

  it('Reconnect: nach einem Abbruch und nach dem Neuladen kehrt man auf den Platz zurück', async () => {
    const server = fakeServer(1);
    render(<App />);
    await act(() => useOnlineStore.getState().join('QX7K2M'));
    act(() => server.emit().disconnected());
    expect(screen.getByRole('status').textContent).toBe('Verbindung unterbrochen, verbinde neu …');
    act(() => server.emit().connected());
    await flush();
    expect(server.calls).toContain('resume:token-1');
    expect(useOnlineStore.getState().status).toBe('online');
    act(() => useOnlineStore.setState({ ticket: null, status: 'offline' }));
    act(() => useOnlineStore.getState().restore());
    act(() => server.emit().connected());
    await flush();
    expect(server.calls.filter((call) => call === 'resume:token-1')).toHaveLength(2);
  });

  it('verlassen schließt die Verbindung und vergisst den Platz', async () => {
    const server = fakeServer();
    await act(() => useOnlineStore.getState().host(3, 'map'));
    act(() => useOnlineStore.getState().leave());
    expect(server.calls).toContain('close');
    expect(localStorage.getItem('stellar.online.ticket')).toBeNull();
    expect(useGameStore.getState().me).toBeNull();
  });
});
