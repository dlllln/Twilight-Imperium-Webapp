import { currentActor, HIDDEN, type GameState, type PlayerId } from '@stellar/domain';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.ts';
import { type Client, connect, hostAndGuest, next, startServer, value } from './server-helpers.ts';

const running: { close(): Promise<void> }[] = [];
const clients: Client[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const server of running.splice(0)) await server.close();
});

async function online() {
  const started = await startServer();
  running.push(started.server);
  return started;
}

async function table() {
  const { url } = await online();
  const seats = await hostAndGuest(url);
  clients.push(seats.host, seats.guest);
  return { url, ...seats };
}

const playerIn = (state: GameState, id: PlayerId) =>
  state.players.find((player) => player.id === id);

/** Behält die ersten geheimen Aufträge; `claimed` ist, wen der Browser als Absender angibt. */
async function keepSecrets(client: Client, player: PlayerId, state: GameState, claimed = player) {
  const choice = playerIn(state, player)?.secretChoice;
  const keep = choice?.options.slice(0, choice.keep) ?? [];
  return client.emitWithAck('game:command', {
    type: 'KeepSecretObjectives',
    issuedBy: claimed,
    keep,
  });
}

describe('Online-Server', () => {
  it('meldet sich gesund und nennt die Speicherung', async () => {
    const { url } = await online();
    const health = await (await fetch(`${url}/health`)).json();
    expect(health).toEqual({ ok: true, storage: 'Speicher / Speicher' });
  });

  it('Lobby: beide sehen die Plätze; der Start verteilt jedem seine eigene Sicht', async () => {
    const { host, guest, hostTicket, guestTicket, guestSeen } = await table();
    const lobby = await guestSeen;
    expect(lobby.seats.map((seat) => seat.name)).toEqual(['Anna', 'Ben', null]);
    const hostSees = next(host, 'game:update', (update) => update.state.phase === 'strategy');
    const guestSees = next(guest, 'game:update', (update) => update.state.phase === 'strategy');
    value(await host.emitWithAck('lobby:start', {}));
    const [mine, theirs] = await Promise.all([hostSees, guestSees]);
    const options = playerIn(mine.state, hostTicket.player)?.secretChoice?.options ?? [];
    expect(options).not.toContain(HIDDEN);
    expect(playerIn(theirs.state, hostTicket.player)?.secretChoice?.options).toContain(HIDDEN);
    expect(playerIn(theirs.state, guestTicket.player)?.secretChoice?.options).not.toContain(HIDDEN);
    expect(mine.state.players.map((player) => player.name)).toEqual(['Anna', 'Ben', 'KI3']);
  });

  it('Commands zählen für den eigenen Platz; danach zieht die KI bis zum nächsten Menschen', async () => {
    const { host, guest, hostTicket, guestTicket, views } = await table();
    value(await host.emitWithAck('lobby:start', {}));
    const strategy = (update: { state: GameState }) => update.state.phase === 'strategy';
    const state = (await views.guest.until(strategy)).state;
    const kept = await keepSecrets(guest, guestTicket.player, state, hostTicket.player);
    expect(kept.ok).toBe(true);
    const guestKept = (update: { state: GameState }) =>
      playerIn(update.state, guestTicket.player)?.secretChoice === null;
    const hostState = (await views.host.until(guestKept)).state;
    expect(playerIn(hostState, hostTicket.player)?.secretChoice).not.toBeNull();
    value(await keepSecrets(host, hostTicket.player, hostState));
    const waiting = await views.host.until((update) => {
      const actor = currentActor(update.state);
      return (
        update.state.players.every((p) => p.secretChoice === null) &&
        actor !== null &&
        actor !== 'p3'
      );
    });
    expect([hostTicket.player, guestTicket.player]).toContain(currentActor(waiting.state));
  });

  it('Reconnect: wer die Verbindung verliert, kehrt mit Code und Schlüssel zurück', async () => {
    const { url, host, guest, guestTicket } = await table();
    const started = next(host, 'game:update', (update) => update.state.phase === 'strategy');
    value(await host.emitWithAck('lobby:start', {}));
    await started;
    const gone = next(host, 'lobby:update', (view) => view.seats[1]?.connected === false);
    guest.disconnect();
    await gone;
    const again = connect(url);
    clients.push(again);
    const restored = next(again, 'game:update');
    const ticket = value(
      await again.emitWithAck('lobby:resume', { code: guestTicket.code, token: guestTicket.token }),
    );
    expect(ticket).toEqual(guestTicket);
    expect((await restored).state.phase).toBe('strategy');
  });

  it('unsinnige Anfragen bekommen eine Fehlermeldung statt den Server anzuhalten', async () => {
    const { url, guest } = await table();
    const stranger = connect(url);
    clients.push(stranger);
    const code = async (promise: Promise<{ ok: boolean; error?: { code: string } }>) => {
      const result = await promise;
      return result.ok ? null : result.error?.code;
    };
    expect(await code(stranger.emitWithAck('game:command', { type: 'Pass' } as never))).toBe(
      'lobby.unknownSeat',
    );
    expect(await code(stranger.emitWithAck('lobby:start', {}))).toBe('lobby.unknownSeat');
    expect(await code(stranger.emitWithAck('lobby:resume', null as never))).toBe(
      'lobby.unknownSeat',
    );
    expect(await code(guest.emitWithAck('game:command', 42 as never))).toBe('server.badCommand');
    expect(await code(guest.emitWithAck('lobby:start', {}))).toBe('lobby.notHost');
    expect(await code(guest.emitWithAck('game:command', { type: 'Pass' } as never))).toBe(
      'lobby.notStarted',
    );
  });

  it('liefert die gebaute Web-App aus, auch für tiefe Links', async () => {
    const dist = await mkdtemp(join(tmpdir(), 'stellar-web-'));
    await writeFile(join(dist, 'index.html'), '<h1>Stellar</h1>');
    const { server, url } = await startServer({ WEB_DIST: dist });
    running.push(server);
    expect(await (await fetch(`${url}/`)).text()).toContain('Stellar');
    expect(await (await fetch(`${url}/lobby/ABC`)).text()).toContain('Stellar');
  });

  it('liest die Einstellungen aus der Umgebung', () => {
    expect(readConfig({})).toMatchObject({ port: 3000, databaseUrl: null, botDelayMs: 400 });
    expect(readConfig({ PORT: 'x', DATABASE_URL: ' ', REDIS_URL: 'redis://r' })).toMatchObject({
      port: 3000,
      databaseUrl: null,
      redisUrl: 'redis://r',
    });
  });
});
