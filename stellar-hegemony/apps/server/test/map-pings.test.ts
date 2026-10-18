import type { MapPing } from '@stellar/application';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type Client,
  connect,
  hostAndGuest,
  mapFor,
  startServer,
  value,
} from './server-helpers.ts';

const running: { close(): Promise<void> }[] = [];
const clients: Client[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const server of running.splice(0)) await server.close();
});

async function table() {
  const { server, url } = await startServer();
  running.push(server);
  const seats = await hostAndGuest(url);
  clients.push(seats.host, seats.guest);
  value(await seats.host.emitWithAck('lobby:start', {}));
  const update = await seats.views.host.until(({ state }) => state.phase === 'strategy');
  const system = Object.keys(update.state.systems)[0] ?? '';
  return { url, ...seats, system, version: update.state.version };
}

const waitForPackets = () => new Promise((resolve) => setTimeout(resolve, 25));

describe('Gemeinsames Zeigen am Spieltisch', () => {
  it('sendet Name und Platz an die eigene Partie, ohne den Spielstand zu ändern', async () => {
    const { host, guest, hostTicket, system, views, version } = await table();
    const seen: MapPing[] = [];
    guest.on('map:ping', (ping) => seen.push(ping));
    const forged = { code: hostTicket.code, system, seat: 2, name: 'Mallory', player: 'p3' };
    const ping = value(await host.emitWithAck('map:ping', forged));
    await waitForPackets();
    expect(ping).toMatchObject({
      code: hostTicket.code,
      system,
      seat: 0,
      name: 'Anna',
      player: hostTicket.player,
      lifetimeMs: 4000,
    });
    expect(seen).toEqual([ping]);
    expect((await views.host.until(() => true)).state.version).toBe(version);
    expect(Object.keys(ping).sort()).toEqual([
      'code',
      'id',
      'lifetimeMs',
      'name',
      'player',
      'seat',
      'system',
    ]);
  });

  it('weist fremde Räume, unbekannte Systeme und nicht angemeldete Verbindungen ab', async () => {
    const { url, host, guest, hostTicket, system } = await table();
    const stranger = connect(url);
    clients.push(stranger);
    const seen: MapPing[] = [];
    guest.on('map:ping', (ping) => seen.push(ping));
    expect(await stranger.emitWithAck('map:ping', { code: hostTicket.code, system })).toMatchObject(
      { ok: false, error: { code: 'lobby.unknownSeat' } },
    );
    expect(await host.emitWithAck('map:ping', { code: 'FOREIGN', system })).toMatchObject({
      ok: false,
      error: { code: 'map.invalidPing' },
    });
    expect(await host.emitWithAck('map:ping', null as never)).toMatchObject({
      ok: false,
      error: { code: 'map.invalidPing' },
    });
    expect(
      await host.emitWithAck('map:ping', { code: hostTicket.code, system: '__proto__' }),
    ).toMatchObject({ ok: false, error: { code: 'map.unknownSystem' } });
    await waitForPackets();
    expect(seen).toEqual([]);
  });

  it('begrenzt schnelle Wiederholungen auch bei gleichzeitigen Anfragen', async () => {
    const { host, guest, hostTicket, system } = await table();
    const seen: MapPing[] = [];
    guest.on('map:ping', (ping) => seen.push(ping));
    const request = { code: hostTicket.code, system };
    const replies = await Promise.all(
      Array.from({ length: 6 }, () => host.emitWithAck('map:ping', request)),
    );
    expect(replies.filter((reply) => reply.ok)).toHaveLength(1);
    expect(
      replies
        .filter((reply) => !reply.ok)
        .every((reply) => reply.error.code === 'map.pingCooldown'),
    ).toBe(true);
    await waitForPackets();
    expect(seen).toHaveLength(1);
  });

  it('entfernt beim Raumwechsel die alte Mitgliedschaft und spielt alte Zeigegesten nicht erneut ab', async () => {
    const { url, host, guest, hostTicket, guestTicket, system } = await table();
    value(await host.emitWithAck('map:ping', { code: hostTicket.code, system }));
    const returning = connect(url);
    clients.push(returning);
    const returned: MapPing[] = [];
    returning.on('map:ping', (ping) => returned.push(ping));
    value(await returning.emitWithAck('lobby:resume', guestTicket));
    const other = value(
      await host.emitWithAck('lobby:create', {
        name: 'Anna',
        playerCount: 3,
        mapString: mapFor(3),
      }),
    );
    const switched: MapPing[] = [];
    host.on('map:ping', (ping) => switched.push(ping));
    expect(other.code).not.toBe(hostTicket.code);
    expect(returned).toEqual([]);
    value(await guest.emitWithAck('map:ping', { code: guestTicket.code, system }));
    await waitForPackets();
    expect(returned).toHaveLength(1);
    expect(switched).toEqual([]);
  });
});
