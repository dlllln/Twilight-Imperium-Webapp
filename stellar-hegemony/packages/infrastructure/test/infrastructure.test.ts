import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { gameId, type GameEvent, type GameState, playerId, replayGame } from '@stellar/domain';
import { BASE_RULE_NUMBERS } from '@stellar/content';
import {
  CryptoIds,
  CryptoRandom,
  InMemoryEventStore,
  InMemoryLobbyStore,
  InProcessEventPublisher,
  SeededRandom,
  SystemClock,
} from '../src/index.ts';

const created: GameEvent = {
  type: 'GameCreated',
  gameId: gameId('g'),
  host: playerId('h'),
  config: { playerCount: 3, victoryPointsToWin: 10, rules: BASE_RULE_NUMBERS },
};

describe('SeededRandom', () => {
  it('gleicher Seed ergibt gleiche Würfe', () => {
    const roll = (seed: number) =>
      Array.from({ length: 20 }, () => new SeededRandom(seed).nextInt(1, 10));
    expect(roll(42)).toEqual(roll(42));
    const sequence = new SeededRandom(7);
    const values = Array.from({ length: 50 }, () => sequence.nextInt(1, 10));
    expect(new Set(values).size).toBeGreaterThan(5);
  });

  it('bleibt immer im angefragten Bereich', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: -100, max: 100 }),
        fc.nat(100),
        (seed, min, span) => {
          const value = new SeededRandom(seed).nextInt(min, min + span);
          return value >= min && value <= min + span;
        },
      ),
    );
  });
});

describe('InMemoryEventStore', () => {
  it('speichert Event-Ströme pro Partie', async () => {
    const store = new InMemoryEventStore();
    expect(await store.append(gameId('g'), 0, [created])).toEqual({ ok: true, value: 1 });
    expect(await store.load(gameId('g'))).toEqual([created]);
    expect(await store.load(gameId('other'))).toEqual([]);
  });

  it('erkennt gleichzeitige Änderungen (optimistische Sperre)', async () => {
    const store = new InMemoryEventStore();
    await store.append(gameId('g'), 0, [created]);
    expect(await store.append(gameId('g'), 0, [created])).toMatchObject({
      ok: false,
      error: { code: 'store.versionConflict' },
    });
  });
});

describe('Uhr und Publisher', () => {
  it('SystemClock liefert die aktuelle Zeit', () => {
    expect(Math.abs(new SystemClock().now() - Date.now())).toBeLessThan(1000);
  });

  it('Publisher benachrichtigt Abonnenten bis zur Abmeldung', () => {
    const publisher = new InProcessEventPublisher();
    const received: number[] = [];
    const unsubscribe = publisher.subscribe((_, events) => received.push(events.length));
    const replayed = replayGame([created]);
    const state = (replayed.ok ? replayed.value : null) as GameState;
    publisher.publish(gameId('g'), [created], state);
    unsubscribe();
    publisher.publish(gameId('g'), [created], state);
    expect(received).toEqual([1]);
  });
});

describe('Online-Adapter ohne Server', () => {
  it('CryptoRandom würfelt gleichverteilt im Bereich', () => {
    const random = new CryptoRandom();
    const rolls = Array.from({ length: 600 }, () => random.nextInt(1, 6));
    expect(rolls.every((roll) => roll >= 1 && roll <= 6)).toBe(true);
    expect(new Set(rolls).size).toBe(6);
  });

  it('CryptoIds: sechsstellige Codes ohne verwechselbare Zeichen, eindeutige Schlüssel', () => {
    const ids = new CryptoIds();
    const codes = Array.from({ length: 200 }, () => ids.lobbyCode());
    expect(codes.every((code) => /^[A-HJ-NP-Z2-9]{6}$/.test(code))).toBe(true);
    expect(ids.seatToken()).not.toBe(ids.seatToken());
  });

  it('InMemoryLobbyStore speichert und lädt Lobbys', async () => {
    const store = new InMemoryLobbyStore();
    const lobby = { code: 'ABC234', gameId: gameId('g'), mapString: '', seats: [], started: false };
    expect(await store.load('ABC234')).toBeNull();
    await store.save(lobby);
    expect(await store.load('ABC234')).toEqual(lobby);
  });
});
