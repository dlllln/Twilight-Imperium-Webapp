import { describe, expect, it } from 'vitest';
import {
  findPlayer,
  orderByInitiative,
  pickStrategyCardHandler,
  playerId,
  strategyCardId,
  type StrategyCardState,
  strategyCardsOf,
} from '../src/index.ts';
import { BLUE, CARD, contextWith, RED } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, startedGame, step } from './game-flow.ts';

const pick = (issuedBy = RED, initiative = 1) =>
  ({ type: 'PickStrategyCard', issuedBy, card: CARD(initiative) }) as const;

describe('Strategiephase (RR 76)', () => {
  it('RR 76.2: nur wer an der Reihe ist, wählt eine freie Karte', () => {
    const state = startedGame();
    expect(pickStrategyCardHandler.decide(state, pick(BLUE))).toMatchObject({
      error: { code: 'strategy.notYourPick' },
    });
    expect(
      pickStrategyCardHandler.decide(state, {
        type: 'PickStrategyCard',
        issuedBy: RED,
        card: strategyCardId('gibt-es-nicht'),
      }),
    ).toMatchObject({ error: { code: 'strategy.unknownCard' } });
    const afterRed = run(state, [pick(RED, 1)]);
    expect(pickStrategyCardHandler.decide(afterRed, pick(BLUE, 1))).toMatchObject({
      error: { code: 'strategy.cardTaken' },
    });
  });

  it('die Wahl rückt die Reihenfolge weiter und vergibt die Karte', () => {
    const { state, events } = step(startedGame(), pick(RED, 3));
    expect(events).toEqual([
      { type: 'StrategyCardPicked', player: RED, card: CARD(3), tradeGoods: 0 },
    ]);
    expect(state.pickQueue[0]).toBe(BLUE);
    expect(strategyCardsOf(state, RED).map((card) => card.initiative)).toEqual([3]);
  });

  it('RR 76.3: nicht gewählte Karten erhalten je 1 Handelsware', () => {
    const state = actionPhaseGame();
    expect(state.strategyCards[CARD(7)]?.tradeGoods).toBe(1);
    expect(state.strategyCards[CARD(8)]?.tradeGoods).toBe(1);
    expect(state.strategyCards[CARD(1)]?.tradeGoods).toBe(0);
  });

  it('RR 76.2: wer eine Karte mit Handelswaren nimmt, erhält sie', () => {
    const start = startedGame();
    const withGoods = {
      ...start,
      strategyCards: {
        ...start.strategyCards,
        [CARD(5)]: { ...(start.strategyCards[CARD(5)] as StrategyCardState), tradeGoods: 2 },
      },
    };
    const { state, events } = step(withGoods, pick(RED, 5));
    expect(events[0]).toMatchObject({ tradeGoods: 2 });
    expect(findPlayer(state, RED)?.tradeGoods).toBe(2);
    expect(state.strategyCards[CARD(5)]?.tradeGoods).toBe(0);
  });

  it('nach der letzten Wahl beginnt die Aktionsphase', () => {
    const state = actionPhaseGame();
    expect(state.phase).toBe('action');
    expect(state.pickQueue).toEqual([]);
    expect(state.actionPhase).toEqual({
      order: [RED, BLUE, GREEN],
      active: RED,
      passed: [],
      secondary: null,
    });
  });

  it('RR 40: Initiative nach der niedrigsten eigenen Kartenzahl', () => {
    const card = (initiative: number, holder: string | null): StrategyCardState => ({
      id: CARD(initiative),
      initiative,
      mechanic: 'trade',
      holder: holder === null ? null : playerId(holder),
      exhausted: false,
      tradeGoods: 0,
    });
    const cards = [
      card(1, 'green'),
      card(2, 'red'),
      card(5, 'blue'),
      card(8, 'red'),
      card(3, null),
    ];
    expect(orderByInitiative([RED, BLUE, GREEN], cards)).toEqual([GREEN, RED, BLUE]);
  });

  it('die Kartenwahl ist außerhalb der Strategiephase gesperrt', () => {
    expect(() => step(actionPhaseGame(), pick(RED, 7), contextWith())).toThrow(
      'phase.commandNotAllowed',
    );
  });
});
