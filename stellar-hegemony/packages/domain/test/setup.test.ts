import { describe, expect, it } from 'vitest';
import {
  clockwiseFrom,
  createGameHandler,
  decideAndApply,
  decideGameCommand,
  evolveGame,
  factionId,
  findPlayer,
  gameId,
  type GameEvent,
  type GameState,
  playerId,
  replayGame,
  type SeatPlayer,
  seatPlayerHandler,
  updatePlayer,
} from '../src/index.ts';
import { BLUE, config, RED, ScriptedRandom } from './fixtures.ts';

const context = { random: new ScriptedRandom([1]), now: 0 };
const created = (): GameEvent => ({ type: 'GameCreated', gameId: gameId('g1'), config: config(3) });

const seat = (id: string, color: SeatPlayer['color'], faction = id): SeatPlayer => ({
  type: 'SeatPlayer',
  issuedBy: playerId(id),
  name: ` ${id} `,
  color,
  faction: factionId(faction),
  commodityLimit: 3,
});

function stateWith(...commands: SeatPlayer[]): GameState {
  const initial = replayGame([created()]);
  if (!initial.ok) throw new Error('kein Start');
  return commands.reduce((state, command) => {
    const decided = decideAndApply(seatPlayerHandler, evolveGame, state, command, context);
    if (!decided.ok) throw new Error(decided.error.code);
    return decided.value.state;
  }, initial.value);
}

describe('Spielaufbau: Partie erstellen und Plätze besetzen', () => {
  it('CreateGame validiert die Konfiguration', () => {
    expect(
      createGameHandler.decide(null, {
        type: 'CreateGame',
        issuedBy: RED,
        gameId: gameId('g'),
        config: config(3),
      }).ok,
    ).toBe(true);
    expect(
      createGameHandler.decide(null, {
        type: 'CreateGame',
        issuedBy: RED,
        gameId: gameId('g'),
        config: config(9),
      }).ok,
    ).toBe(false);
  });

  it('RR 46.1: neue Spieler starten mit 3/3/2 Markern und 8 im Nachschub', () => {
    const player = findPlayer(stateWith(seat('red', 'red')), RED);
    expect(player?.commandPools).toEqual({ tactic: 3, fleet: 3, strategy: 2 });
    expect(player?.reinforcementTokens).toBe(8);
    expect(player?.name).toBe('red');
  });

  it('Farben, Fraktionen und Plätze sind eindeutig', () => {
    const state = stateWith(seat('red', 'red'));
    const decide = (command: SeatPlayer) => decideGameCommand(state, command, context);
    expect(decide(seat('red', 'blue', 'x'))).toMatchObject({
      ok: false,
      error: { code: 'setup.alreadySeated' },
    });
    expect(decide(seat('blue', 'red', 'x'))).toMatchObject({
      ok: false,
      error: { code: 'setup.colorTaken' },
    });
    expect(decide(seat('blue', 'blue', 'red'))).toMatchObject({
      ok: false,
      error: { code: 'setup.factionTaken' },
    });
    expect(decide({ ...seat('blue', 'blue'), name: '  ' })).toMatchObject({
      ok: false,
      error: { code: 'setup.nameMissing' },
    });
  });

  it('nicht mehr Spieler als konfiguriert', () => {
    const state = stateWith(seat('a', 'red'), seat('b', 'blue'), seat('c', 'green'));
    expect(decideGameCommand(state, seat('d', 'pink'), context)).toMatchObject({
      ok: false,
      error: { code: 'setup.full' },
    });
  });

  it('nach Spielbeginn und nach Spielende sind keine Plätze mehr frei', () => {
    const state = stateWith(seat('a', 'red'));
    expect(decideGameCommand({ ...state, phase: 'strategy' }, seat('b', 'blue'), context).ok).toBe(
      false,
    );
    expect(decideGameCommand({ ...state, winner: RED }, seat('b', 'blue'), context)).toMatchObject({
      ok: false,
      error: { code: 'game.over' },
    });
  });

  it('Replay ergibt denselben Zustand wie die schrittweise Anwendung', () => {
    const live = stateWith(seat('red', 'red'), seat('blue', 'blue'));
    const events: GameEvent[] = [created()];
    for (const command of [seat('red', 'red'), seat('blue', 'blue')]) {
      const state = replayGame(events);
      if (!state.ok) throw new Error('replay');
      const decided = decideGameCommand(state.value, command, context);
      if (decided.ok) events.push(...decided.value);
    }
    expect(replayGame(events)).toEqual({ ok: true, value: live });
    expect(live.version).toBe(3);
  });

  it('Replay ohne GameCreated am Anfang schlägt fehl', () => {
    expect(replayGame([]).ok).toBe(false);
  });

  it('Sitzreihenfolge im Uhrzeigersinn ab einem Spieler', () => {
    const state = stateWith(seat('red', 'red'), seat('blue', 'blue'), seat('green', 'green'));
    expect(clockwiseFrom(state, BLUE).map((p) => p.id)).toEqual(['blue', 'green', 'red']);
    expect(clockwiseFrom(state, playerId('unknown')).map((p) => p.id)).toEqual([
      'red',
      'blue',
      'green',
    ]);
  });

  it('updatePlayer ändert nur den gewählten Spieler', () => {
    const state = stateWith(seat('red', 'red'), seat('blue', 'blue'));
    const next = updatePlayer(state, RED, (p) => ({ ...p, tradeGoods: 2 }));
    expect(findPlayer(next, RED)?.tradeGoods).toBe(2);
    expect(findPlayer(next, BLUE)?.tradeGoods).toBe(0);
  });

  it('decideAndApply gibt Fehler des Handlers weiter', () => {
    const state = stateWith(seat('red', 'red'));
    expect(
      decideAndApply(seatPlayerHandler, evolveGame, state, seat('red', 'red'), context).ok,
    ).toBe(false);
  });
});
