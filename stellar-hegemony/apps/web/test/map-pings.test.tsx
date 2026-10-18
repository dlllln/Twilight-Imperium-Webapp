// @vitest-environment jsdom
import type { LobbyView, MapPing, SeatTicket } from '@stellar/application';
import { seatPlayerId } from '@stellar/application';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapPings } from '../src/components/MapPings.tsx';
import { clearMapPings, receiveMapPing, useMapPingStore } from '../src/online/map-ping-store.ts';
import type { ConnectionEvents, OnlineConnection } from '../src/online/online-connection.ts';
import { setConnector, useOnlineStore } from '../src/online/online-store.ts';
import { FLAT_VIEW } from '../src/render/board-view.ts';
import { gameScene } from '../src/render/scene-model.ts';
import { seatColor } from '../src/seat-colors.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { started } from './game-helpers.ts';

const ticket: SeatTicket = { code: 'ABCDEF', token: 'secret', seat: 0, player: seatPlayerId(0) };
const lobby: LobbyView = { code: ticket.code, started: true, seats: [] };
const ok = <T,>(value: T) => ({ ok: true as const, value });
const ping = (id = '1', seat = 0): MapPing => ({
  id,
  code: ticket.code,
  system: Object.keys(started().systems)[0] ?? '',
  seat,
  player: seatPlayerId(seat),
  name: `Spieler ${String(seat + 1)}`,
  lifetimeMs: 4000,
});

function server() {
  let handlers: ConnectionEvents | null = null;
  const send = vi.fn((request: { code: string; system: string }) =>
    Promise.resolve(ok({ ...ping(), ...request })),
  );
  const connection: OnlineConnection = {
    create: () => Promise.resolve(ok(ticket)),
    join: () => Promise.resolve(ok(ticket)),
    resume: () => Promise.resolve(ok(ticket)),
    start: () => Promise.resolve(ok(lobby)),
    faction: () => Promise.resolve(ok(lobby)),
    command: () => Promise.resolve(ok({ version: 1, undoable: false })),
    undo: () => Promise.resolve(ok(1)),
    ping: send,
    close: () => undefined,
  };
  setConnector((events) => {
    handlers = events;
    return connection;
  });
  return {
    send,
    events: () => {
      if (handlers === null) throw new Error('disconnected');
      return handlers;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  useOnlineStore.getState().leave();
  useOnlineStore.setState({ name: 'Anna' });
  useGalaxyStore.setState({ language: 'de' });
});

afterEach(() => {
  cleanup();
  useOnlineStore.getState().leave();
  clearMapPings();
  vi.useRealTimers();
});

describe('Flüchtige Zeigegesten im Browser', () => {
  it('sendet nur vorhandene Systeme einer laufenden eigenen Online-Partie', async () => {
    const fake = server();
    expect(await useOnlineStore.getState().pingSystem(ping().system)).toBe(false);
    await useOnlineStore.getState().join(ticket.code);
    expect(await useOnlineStore.getState().pingSystem(ping().system)).toBe(false);
    fake.events().game({ state: started(), events: [] });
    expect(await useOnlineStore.getState().pingSystem('__proto__')).toBe(false);
    expect(await useOnlineStore.getState().pingSystem(ping().system)).toBe(true);
    expect(fake.send).toHaveBeenCalledExactlyOnceWith({ code: ticket.code, system: ping().system });
  });

  it('ignoriert fremde Räume und unbekannte Systeme und löscht Marker bei Verbindungsabbruch', async () => {
    const fake = server();
    await useOnlineStore.getState().join(ticket.code);
    fake.events().game({ state: started(), events: [] });
    fake.events().ping?.({ ...ping(), code: 'FOREIGN' });
    fake.events().ping?.({ ...ping(), system: '__proto__' });
    expect(useMapPingStore.getState().pings).toEqual([]);
    fake.events().ping?.(ping());
    expect(useMapPingStore.getState().pings).toHaveLength(1);
    fake.events().disconnected();
    expect(useMapPingStore.getState().pings).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(await useOnlineStore.getState().pingSystem(ping().system)).toBe(false);
  });

  it('zeigt pro Spieler die jüngste Geste, begrenzt gleichzeitig sichtbare Marker und entfernt sie nach vier Sekunden', () => {
    receiveMapPing(ping('old'));
    receiveMapPing(ping('new'));
    expect(useMapPingStore.getState().pings.map((mark) => mark.id)).toEqual(['new']);
    for (let seat = 1; seat <= 10; seat += 1) receiveMapPing(ping(String(seat), seat));
    expect(useMapPingStore.getState().pings).toHaveLength(8);
    expect(vi.getTimerCount()).toBe(8);
    vi.advanceTimersByTime(4000);
    expect(useMapPingStore.getState().pings).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('verlassen löscht auch noch laufende Timer und Reconnect übernimmt keine alten Gesten', async () => {
    const fake = server();
    await useOnlineStore.getState().join(ticket.code);
    fake.events().game({ state: started(), events: [] });
    fake.events().ping?.(ping());
    fake.events().connected();
    await Promise.resolve();
    expect(useMapPingStore.getState().pings).toEqual([]);
    fake.events().ping?.(ping());
    useOnlineStore.getState().leave();
    expect(useMapPingStore.getState().pings).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('zeichnet Namen und Spielerfarbe am System und bewegt sie mit der Kamera', () => {
    act(() => receiveMapPing(ping('visible', 1)));
    const props = {
      hexes: gameScene(started(), content, 'de'),
      bounds: { minX: -500, minY: -500, width: 1000, height: 1000 },
      viewport: { panX: 0, panY: 0, zoom: 1 },
      view: FLAT_VIEW,
      size: { width: 1000, height: 1000 },
    };
    const { container, rerender } = render(<MapPings {...props} />);
    expect(screen.getByRole('status').textContent).toContain('Spieler 2zeigt auf');
    const mark = container.querySelector<HTMLElement>('.map-ping');
    expect(mark?.style.color).toBe('rgb(86, 180, 233)');
    expect(seatColor(2)).toBe('#56B4E9');
    const original = Number.parseFloat(mark?.style.left ?? '0');
    rerender(<MapPings {...props} viewport={{ ...props.viewport, panX: 100 }} />);
    expect(Number.parseFloat(mark?.style.left ?? '0') - original).toBeCloseTo(100);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
