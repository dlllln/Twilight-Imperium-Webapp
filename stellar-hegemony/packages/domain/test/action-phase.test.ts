import { describe, expect, it } from 'vitest';
import {
  type GameState,
  NO_PAYMENT,
  nextActivePlayer,
  passHandler,
  performStrategicActionHandler,
  planetId,
  type PlayerId,
  type PoolCounts,
  previewCommandTokens,
  resolveSecondaryHandler,
  type StrategyCardState,
  updatePlayer,
} from '../src/index.ts';
import { BLUE, CARD, content, contextWith, RED } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, step } from './game-flow.ts';

const THRONE = planetId('throne');
const BETA = planetId('beta-1');

/** Rot kontrolliert die Thronwelt (6 Einfluss) und beta-1 (2 Einfluss). */
function game(): GameState {
  const state = actionPhaseGame();
  return {
    ...state,
    planets: {
      ...state.planets,
      [THRONE]: { id: THRONE, controller: RED, exhausted: false, units: [] },
      [BETA]: { id: BETA, controller: RED, exhausted: false, units: [] },
    },
  };
}

const pools = (tactic: number, fleet = 0, strategy = 0): PoolCounts => ({
  tactic,
  fleet,
  strategy,
});

const vanguard = (allocation: PoolCounts, planets = [THRONE], tradeGoods = 0, issuedBy = RED) =>
  ({
    type: 'PerformStrategicAction',
    issuedBy,
    card: CARD(1),
    choice: { mechanic: 'commandTokens', influence: { planets, tradeGoods }, allocation },
  }) as const;

const noTokens = (issuedBy: PlayerId) =>
  ({
    type: 'ResolveSecondary',
    issuedBy,
    choice: { mechanic: 'commandTokens', influence: NO_PAYMENT, allocation: pools(0) },
  }) as const;

const decline = (issuedBy: PlayerId) => ({ type: 'DeclineSecondary', issuedBy }) as const;
const pass = (issuedBy: PlayerId) => ({ type: 'Pass', issuedBy }) as const;

/** Markiert alle Karten eines Spielers als genutzt. */
const exhaustAll = (state: GameState): GameState => ({
  ...state,
  strategyCards: Object.fromEntries(
    Object.entries(state.strategyCards).map(([id, card]) => [id, { ...card, exhausted: true }]),
  ),
});

describe('Strategische Aktion: Kommandomarker (RR 29, RR 74)', () => {
  it('Primär: 3 Marker plus 1 je 3 Einfluss, Planeten werden erschöpft', () => {
    const { state, events } = step(game(), vanguard(pools(2, 2, 1)));
    expect(events.map((event) => event.type)).toEqual([
      'StrategicActionPerformed',
      'PlanetsExhausted',
      'CommandTokensGained',
    ]);
    const red = state.players.find((player) => player.id === RED);
    expect(red?.commandPools).toEqual({ tactic: 5, fleet: 5, strategy: 3 });
    expect(red?.reinforcementTokens).toBe(3);
    expect(state.planets[THRONE]?.exhausted).toBe(true);
    expect(state.strategyCards[CARD(1)]?.exhausted).toBe(true);
    expect(state.actionPhase?.secondary).toEqual({
      card: CARD(1),
      awaiting: [BLUE, GREEN],
      free: [],
    });
  });

  it('RR 29.2: angebrochene Einflussmengen zählen nicht; Handelswaren zählen als Einfluss', () => {
    const rich = updatePlayer(game(), RED, (p) => ({ ...p, tradeGoods: 2 }));
    const { state, events } = step(rich, vanguard(pools(4), [BETA], 2));
    expect(events).toContainEqual({ type: 'TradeGoodsSpent', player: RED, amount: 2 });
    expect(state.players.find((p) => p.id === RED)?.tradeGoods).toBe(0);
  });

  it('RR 46.3: nicht mehr Marker als im Nachschub', () => {
    const scarce = updatePlayer(game(), RED, (p) => ({ ...p, reinforcementTokens: 2 }));
    expect(step(scarce, vanguard(pools(2), [])).state.players[0]?.reinforcementTokens).toBe(0);
    const result = performStrategicActionHandler.decide(
      scarce,
      vanguard(pools(3), []),
      contextWith(),
    );
    expect(result).toMatchObject({
      error: { code: 'tokens.allocationMismatch', details: { gained: 2 } },
    });
  });

  it('die Verteilung muss gültig sein', () => {
    const result = performStrategicActionHandler.decide(
      game(),
      vanguard(pools(6, -1), []),
      contextWith(),
    );
    expect(result).toMatchObject({ error: { code: 'tokens.invalidAllocation' } });
  });

  it('nur der aktive Spieler mit eigener, unbenutzter Karte', () => {
    const state = game();
    const decide = (command: Parameters<typeof performStrategicActionHandler.decide>[1]) =>
      performStrategicActionHandler.decide(state, command, contextWith());
    expect(decide(vanguard(pools(3), [], 0, BLUE))).toMatchObject({
      error: { code: 'action.notYourTurn' },
    });
    expect(decide({ ...vanguard(pools(3), []), card: CARD(2) })).toMatchObject({
      error: { code: 'strategy.notYourCard' },
    });
    expect(
      performStrategicActionHandler.decide(
        exhaustAll(state),
        vanguard(pools(3), []),
        contextWith(),
      ),
    ).toMatchObject({ error: { code: 'strategy.cardUsed' } });
  });

  it('Karten, deren Mechanik noch fehlt, sind gesperrt', () => {
    const base = game();
    const imperial = { ...base.strategyCards[CARD(8)], holder: RED } as StrategyCardState;
    const unknown = content.strategyCards.map((card) =>
      card.id === CARD(8) ? { ...card, mechanic: 'unknown' as never } : card,
    );
    const result = performStrategicActionHandler.decide(
      { ...base, strategyCards: { ...base.strategyCards, [CARD(8)]: imperial } },
      { ...vanguard(pools(3), []), card: CARD(8) },
      { ...contextWith(), content: { ...content, strategyCards: unknown } },
    );
    expect(result).toMatchObject({
      error: { code: 'strategy.mechanicUnavailable', details: { mechanic: 'unknown' } },
    });
  });

  it('fehlende Stammdaten oder Parameter sind Fehler, keine Ausnahmen', () => {
    const noCards = { ...contextWith(), content: { ...content, strategyCards: [] } };
    expect(
      performStrategicActionHandler.decide(game(), vanguard(pools(3), []), noCards),
    ).toMatchObject({ error: { code: 'strategy.unknownCard' } });
    const bare = content.strategyCards.map((card) => ({ ...card, parameters: {} }));
    const noParameters = { ...contextWith(), content: { ...content, strategyCards: bare } };
    expect(
      performStrategicActionHandler.decide(game(), vanguard(pools(3), []), noParameters),
    ).toMatchObject({ error: { code: 'strategy.parameter' } });
  });
});

describe('Vorschau für Clients', () => {
  it('liefert dieselbe Markerzahl wie die Regel', () => {
    const card = content.strategyCards[0];
    if (card === undefined) throw new Error('Karte fehlt');
    const input = { state: game(), player: RED, card, context: contextWith() };
    const influence = { planets: [THRONE, BETA], tradeGoods: 0 };
    expect(previewCommandTokens({ ...input, influence }, 'primary')).toEqual({
      ok: true,
      value: 5,
    });
    expect(previewCommandTokens({ ...input, influence }, 'secondary')).toEqual({
      ok: true,
      value: 2,
    });
  });
});

describe('Sekundärfähigkeiten reihum (RR 74.4)', () => {
  it('erst links vom aktiven Spieler, dann weiter im Uhrzeigersinn', () => {
    const acted = run(game(), [vanguard(pools(3), [])]);
    expect(() => step(acted, decline(GREEN))).toThrow('action.notYourSecondary');
    expect(() => step(acted, pass(RED))).toThrow('action.secondaryOpen');
    const { state, events } = step(acted, noTokens(BLUE));
    expect(events).toEqual([{ type: 'SecondaryResolved', player: BLUE, paidStrategyToken: false }]);
    expect(state.actionPhase?.secondary?.awaiting).toEqual([GREEN]);
  });

  it('nach der letzten Entscheidung ist der nächste Spieler am Zug', () => {
    const acted = run(game(), [vanguard(pools(3), []), noTokens(BLUE)]);
    const { state, events } = step(acted, decline(GREEN));
    expect(events).toEqual([
      { type: 'SecondaryDeclined', player: GREEN },
      { type: 'TurnEnded', player: RED, next: BLUE },
    ]);
    expect(state.actionPhase).toMatchObject({ active: BLUE, secondary: null });
  });

  it('RR 46.5: eine Sekundärfähigkeit kann einen Strategiemarker kosten', () => {
    const blueTurn = run(game(), [vanguard(pools(3), []), decline(BLUE), decline(GREEN)]);
    const blueAction = {
      type: 'PerformStrategicAction',
      issuedBy: BLUE,
      card: CARD(2),
      choice: { mechanic: 'commandTokens', influence: NO_PAYMENT, allocation: pools(2) },
    } as const;
    const opened = run(blueTurn, [blueAction]);
    const { state } = step(opened, noTokens(GREEN));
    expect(state.players.find((p) => p.id === GREEN)?.commandPools.strategy).toBe(1);
    const broke = updatePlayer(state, RED, (p) => ({ ...p, commandPools: pools(3) }));
    expect(resolveSecondaryHandler.decide(broke, noTokens(RED), contextWith())).toMatchObject({
      error: { code: 'action.noStrategyToken' },
    });
  });
});

describe('Passen und Ende der Aktionsphase (RR 4)', () => {
  it('RR 4.3: erst passen, wenn alle eigenen Strategiekarten genutzt sind', () => {
    expect(passHandler.decide(game(), pass(RED))).toMatchObject({
      error: { code: 'action.strategyCardUnused' },
    });
  });

  it('nach dem Passen wird man übersprungen; zuletzt beginnt die Statusphase', () => {
    const ready = exhaustAll(game());
    const afterRed = step(ready, pass(RED));
    expect(afterRed.events.at(-1)).toEqual({ type: 'TurnEnded', player: RED, next: BLUE });
    const afterBlue = run(afterRed.state, [pass(BLUE)]);
    expect(afterBlue.actionPhase?.active).toBe(GREEN);
    const end = step(afterBlue, pass(GREEN));
    expect(end.events.slice(-2)).toEqual([
      { type: 'TurnEnded', player: GREEN, next: null },
      { type: 'StatusPhaseStarted', round: 1, order: [RED, BLUE, GREEN] },
    ]);
    expect(end.state.phase).toBe('status');
    expect(end.state.actionPhase).toBeNull();
  });

  it('wer als Einziger nicht gepasst hat, ist weiter am Zug', () => {
    const turn = {
      order: [RED, BLUE, GREEN],
      active: GREEN,
      passed: [RED, BLUE],
      secondary: null,
      tactical: null,
      transaction: null,
      transactedWith: [],
    };
    expect(nextActivePlayer(turn, GREEN, [RED, BLUE])).toBe(GREEN);
    expect(nextActivePlayer(turn, BLUE, [RED])).toBe(GREEN);
  });
});
