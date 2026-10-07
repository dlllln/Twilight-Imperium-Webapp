import { describe, expect, it } from 'vitest';
import { currentActor, type GameState, playerId } from '@stellar/domain';
import { lobbyView, SerialQueue } from '../src/index.ts';
import { CountingIds, mapFor, onlineGames } from './online-helpers.ts';

const P1 = playerId('p1');
const P2 = playerId('p2');

async function lobbyWithGuest(playerCount = 3) {
  const setup = onlineGames();
  const host = await setup.online.create({
    name: 'Anna',
    playerCount,
    mapString: mapFor(playerCount),
  });
  if (!host.ok) throw new Error(host.error.code);
  const guest = await setup.online.join({ code: host.value.ticket.code, name: 'Ben' });
  if (!guest.ok) throw new Error(guest.error.code);
  return { ...setup, host: host.value.ticket, guest: guest.value.ticket };
}

async function startedGame() {
  const setup = await lobbyWithGuest();
  const started = await setup.online.start(setup.host.code, setup.host.token);
  if (!started.ok) throw new Error(started.error.code);
  return setup;
}

const stateOf = async (setup: Awaited<ReturnType<typeof startedGame>>): Promise<GameState> => {
  const state = await setup.online.state(setup.host.code);
  if (!state.ok) throw new Error(state.error.code);
  return state.value;
};

/** Menschen wählen zuerst ihre geheimen Aufträge (RR 12.20); danach ist die KI dran. */
async function keepSecrets(
  setup: Awaited<ReturnType<typeof startedGame>>,
  ticket: { code: string; token: string; player: typeof P1 },
) {
  const state = await stateOf(setup);
  const choice = state.players.find((player) => player.id === ticket.player)?.secretChoice;
  const keep = choice?.options.slice(0, choice.keep) ?? [];
  await setup.online.submit(ticket.code, ticket.token, {
    type: 'KeepSecretObjectives',
    issuedBy: ticket.player,
    keep,
  });
}

const errorCode = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? null : result.error?.code;

describe('Online-Lobby', () => {
  it('der Gastgeber eröffnet mit Code und sitzt auf Platz 1, Gäste füllen die nächsten', async () => {
    const { host, guest, online } = await lobbyWithGuest(4);
    expect(host).toEqual({ code: 'ABC001', token: 't1', seat: 0, player: P1 });
    expect(guest).toMatchObject({ code: 'ABC001', seat: 1, player: P2 });
    const lobby = await online.lobby('ABC001');
    expect(lobby.ok && lobbyView(lobby.value, [0])).toEqual({
      code: 'ABC001',
      started: false,
      seats: [
        { seat: 0, kind: 'human', name: 'Anna', connected: true },
        { seat: 1, kind: 'human', name: 'Ben', connected: false },
        { seat: 2, kind: 'open', name: null, connected: false },
        { seat: 3, kind: 'open', name: null, connected: false },
      ],
    });
  });

  it('Namen, Spielerzahl und Galaxie werden vor dem Eröffnen geprüft', async () => {
    const { online } = onlineGames();
    const valid = { name: 'Anna', playerCount: 3, mapString: mapFor(3) };
    expect(errorCode(await online.create({ ...valid, name: ' \u0000 ' }))).toBe('lobby.name');
    expect(errorCode(await online.create({ ...valid, playerCount: 9 }))).toBe('config.playerCount');
    expect(errorCode(await online.create({ ...valid, mapString: mapFor(4) }))).not.toBeNull();
    const long = await online.create({ ...valid, name: 'x'.repeat(40) });
    expect(long.ok && long.value.lobby.seats[0]?.name).toHaveLength(24);
  });

  it('volle, gestartete und unbekannte Lobbys nehmen niemanden mehr auf', async () => {
    const { online, host } = await lobbyWithGuest();
    expect(errorCode(await online.join({ code: 'NICHTS', name: 'X' }))).toBe('lobby.notFound');
    expect((await online.join({ code: host.code, name: 'Cleo' })).ok).toBe(true);
    expect(errorCode(await online.join({ code: host.code, name: 'Dan' }))).toBe('lobby.full');
    await online.start(host.code, host.token);
    expect(errorCode(await online.join({ code: host.code, name: 'Eve' }))).toBe('lobby.started');
  });

  it('besetzte Codes werden nicht doppelt vergeben', async () => {
    const { online } = onlineGames({ ids: new CountingIds(1) });
    const request = { name: 'Anna', playerCount: 3, mapString: mapFor(3) };
    expect((await online.create(request)).ok).toBe(true);
    expect(errorCode(await online.create(request))).toBe('lobby.busy');
  });

  it('Reconnect: mit Code und Schlüssel kehrt man auf den eigenen Platz zurück', async () => {
    const { online, guest } = await lobbyWithGuest();
    const back = await online.resume(guest.code, guest.token);
    expect(back.ok && back.value.ticket).toEqual(guest);
    expect(errorCode(await online.resume(guest.code, 'falsch'))).toBe('lobby.unknownSeat');
  });
});

describe('Online-Partie', () => {
  it('nur der Gastgeber startet; freie Plätze übernimmt die KI', async () => {
    const setup = await lobbyWithGuest();
    const { online, host, guest } = setup;
    expect(errorCode(await online.state(host.code))).toBe('lobby.notStarted');
    expect(errorCode(await online.start(host.code, guest.token))).toBe('lobby.notHost');
    const started = await online.start(host.code, host.token);
    expect(started.ok && started.value.seats.map((seat) => seat.kind)).toEqual([
      'human',
      'human',
      'bot',
    ]);
    expect(errorCode(await online.start(host.code, host.token))).toBe('lobby.started');
    const state = await stateOf(setup);
    expect(state.players.map((player) => player.name)).toEqual(['Anna', 'Ben', 'KI3']);
    expect(state.phase).toBe('strategy');
  });

  it('Commands gelten immer für den eigenen Platz, auch wenn der Browser etwas anderes sendet', async () => {
    const setup = await startedGame();
    const before = await stateOf(setup);
    const choice = before.players.find((player) => player.id === P2)?.secretChoice;
    const keep = choice?.options.slice(0, choice.keep) ?? [];
    const { online, guest } = setup;
    const sent = await online.submit(guest.code, guest.token, {
      type: 'KeepSecretObjectives',
      issuedBy: P1,
      keep,
    });
    expect(sent.ok).toBe(true);
    const after = await stateOf(setup);
    expect(after.players.find((player) => player.id === P2)?.secretObjectives).toEqual(keep);
    expect(after.players.find((player) => player.id === P1)?.secretChoice).not.toBeNull();
    expect(errorCode(await online.submit(guest.code, 'falsch', { type: 'Pass', issuedBy: P2 })));
  });

  it('die KI zieht auf dem Server, bis ein Mensch entscheiden muss', async () => {
    const setup = await startedGame();
    const { online, host, guest } = setup;
    expect(await online.botStep(host.code)).toEqual({ ok: true, value: false });
    await keepSecrets(setup, host);
    await keepSecrets(setup, guest);
    let steps = 0;
    for (;;) {
      const step = await online.botStep(host.code);
      if (!step.ok || !step.value) break;
      steps += 1;
    }
    expect(steps).toBeGreaterThan(0);
    const actor = currentActor(await stateOf(setup));
    expect([P1, P2]).toContain(actor);
    expect(setup.published.length).toBeGreaterThan(steps);
  });

  it('findet die KI keinen Zug, meldet der Server das statt zu hängen', async () => {
    const setup = onlineGames({ bot: { nextCommand: () => null } });
    const host = await setup.online.create({ name: 'A', playerCount: 3, mapString: mapFor(3) });
    if (!host.ok) throw new Error(host.error.code);
    const { code, token } = host.value.ticket;
    await setup.online.start(code, token);
    await keepSecrets(
      { ...setup, host: host.value.ticket, guest: host.value.ticket },
      host.value.ticket,
    );
    const step = await setup.online.botStep(code);
    expect(errorCode(step)).toBe('lobby.botStuck');
  });
});

describe('SerialQueue', () => {
  it('führt Aufgaben je Schlüssel nacheinander aus, auch nach einem Fehler', async () => {
    const queue = new SerialQueue();
    const order: string[] = [];
    const slow = queue.run('a', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push('erste');
    });
    const failing = queue.run('a', () => Promise.reject(new Error('kaputt')));
    const last = queue.run('a', () => Promise.resolve(order.push('dritte')));
    await Promise.allSettled([slow, failing, last]);
    expect(order).toEqual(['erste', 'dritte']);
    await expect(failing).rejects.toThrow('kaputt');
  });
});
