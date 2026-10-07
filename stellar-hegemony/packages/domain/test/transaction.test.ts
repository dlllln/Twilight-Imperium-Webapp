import { describe, expect, it } from 'vitest';
import {
  acceptTransactionHandler,
  adjacentSystemIds,
  areNeighbors,
  evolveGame,
  type GameState,
  type Goods,
  neighborsOf,
  type PlayerId,
  proposeTransactionHandler,
  rejectTransactionHandler,
  type SystemId,
  updatePlayer,
} from '../src/index.ts';
import { BLUE, RED, T, unit } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, step } from './game-flow.ts';

const homeOf = (state: GameState, player: PlayerId): SystemId => {
  const home = Object.values(state.systems).find((system) =>
    system.spaceUnits.some((u) => u.owner === player),
  );
  if (home === undefined) throw new Error('keine Heimat');
  return home.id;
};

/** Legt einen Kreuzer von `owner` in das System `id`. */
function shipIn(state: GameState, id: SystemId, owner: PlayerId): GameState {
  const system = state.systems[id] as GameState['systems'][string];
  const spaceUnits = [...system.spaceUnits, unit(T.cruiser, owner)];
  return { ...state, systems: { ...state.systems, [id]: { ...system, spaceUnits } } };
}

/** Rot und Blau sind Nachbarn (blauer Kreuzer in Rots Heimat), beide mit Waren. */
function neighbours(): GameState {
  const state = actionPhaseGame();
  const shared = shipIn(state, homeOf(state, RED), BLUE);
  const stocked = (s: GameState, p: PlayerId) =>
    updatePlayer(s, p, (player) => ({ ...player, tradeGoods: 3, commodities: 2 }));
  return stocked(stocked(shared, RED), BLUE);
}

const goods = (tradeGoods: number, commodities = 0): Goods => ({ tradeGoods, commodities });

const propose = (offer: Goods, request: Goods, partner = BLUE, issuedBy = RED) =>
  ({ type: 'ProposeTransaction', issuedBy, partner, offer, request }) as const;

const accept = (issuedBy: PlayerId = BLUE) => ({ type: 'AcceptTransaction', issuedBy }) as const;
const reject = (issuedBy: PlayerId) => ({ type: 'RejectTransaction', issuedBy }) as const;

const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? 'ok' : result.error?.code;

const playerOf = (state: GameState, id: PlayerId) => state.players.find((p) => p.id === id);

describe('Nachbarn (RR 55)', () => {
  it('RR 55: gemeinsames System oder angrenzende Systeme mit Einheiten machen zu Nachbarn', () => {
    const state = actionPhaseGame();
    expect(areNeighbors(state, RED, BLUE)).toBe(false);
    expect(areNeighbors(state, RED, RED)).toBe(false);
    expect(neighborsOf(neighbours(), RED)).toEqual([BLUE]);
    const home = state.systems[homeOf(state, RED)] as GameState['systems'][string];
    const next = adjacentSystemIds(state.systems, home)[0] as SystemId;
    expect(areNeighbors(shipIn(state, next, GREEN), RED, GREEN)).toBe(true);
  });
});

describe('Transaktionen (RR 82)', () => {
  it('RR 82.2/50.1: getauschte Rohstoffe werden beim Empfänger zu Handelswaren', () => {
    const offered = step(neighbours(), propose(goods(2, 1), goods(0, 1)));
    expect(offered.state.actionPhase?.transaction).toMatchObject({ from: RED, to: BLUE });
    const { state } = step(offered.state, accept());
    expect(playerOf(state, RED)).toMatchObject({ tradeGoods: 2, commodities: 1 });
    expect(playerOf(state, BLUE)).toMatchObject({ tradeGoods: 6, commodities: 1 });
    expect(state.actionPhase).toMatchObject({ transaction: null, transactedWith: [BLUE] });
  });

  it('RR 82.1: mit jedem Nachbarn höchstens eine Transaktion je Zug', () => {
    const done = run(neighbours(), [propose(goods(1), goods(0)), accept()]);
    expect(codeOf(proposeTransactionHandler.decide(done, propose(goods(1), goods(0))))).toBe(
      'transaction.alreadyDone',
    );
    // Mit dem Zugende beginnt die Zählung neu.
    const nextTurn = evolveGame(done, { type: 'TurnEnded', player: RED, next: BLUE });
    expect(nextTurn.actionPhase).toMatchObject({ transaction: null, transactedWith: [] });
  });

  it('RR 82.4: ablehnen oder zurückziehen; nichts wechselt den Besitzer', () => {
    const offered = run(neighbours(), [propose(goods(1), goods(1))]);
    const before = offered.players;
    for (const player of [BLUE, RED]) {
      const after = step(offered, reject(player));
      expect(after.events).toEqual([{ type: 'TransactionRejected', from: RED, to: BLUE }]);
      expect(after.state.players).toEqual(before);
      expect(after.state.actionPhase?.transaction).toBeNull();
    }
    expect(codeOf(rejectTransactionHandler.decide(offered, reject(GREEN)))).toBe(
      'transaction.noOffer',
    );
  });

  it('nur der aktive Spieler, nur Nachbarn, ein Angebot zur Zeit, gültige und vorhandene Waren', () => {
    const state = neighbours();
    const decide = (command: ReturnType<typeof propose>, s = state) =>
      codeOf(proposeTransactionHandler.decide(s, command));
    expect(decide(propose(goods(1), goods(0), RED, BLUE))).toBe('action.notYourTurn');
    expect(decide(propose(goods(1), goods(0), GREEN))).toBe('transaction.notNeighbor');
    expect(decide(propose(goods(-1), goods(0)))).toBe('transaction.invalidGoods');
    expect(decide(propose(goods(4), goods(0)))).toBe('transaction.notEnough');
    const offered = run(state, [propose(goods(1), goods(0))]);
    expect(decide(propose(goods(1), goods(0)), offered)).toBe('transaction.pending');
  });

  it('zustimmen kann nur der Empfänger, und nur solange beide die Waren haben', () => {
    const offered = run(neighbours(), [propose(goods(1), goods(0, 2))]);
    expect(codeOf(acceptTransactionHandler.decide(offered, accept(GREEN)))).toBe(
      'transaction.noOffer',
    );
    const spent = updatePlayer(offered, BLUE, (p) => ({ ...p, commodities: 1 }));
    expect(codeOf(acceptTransactionHandler.decide(spent, accept()))).toBe('transaction.notEnough');
  });
});
