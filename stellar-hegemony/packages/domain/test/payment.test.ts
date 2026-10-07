import { describe, expect, it } from 'vitest';
import {
  evaluatePayment,
  evolveGame,
  findPlanetDefinition,
  type GameState,
  type Payment,
  paymentEvents,
  planetId,
  updatePlayer,
} from '../src/index.ts';
import { BLUE, content, RED } from './fixtures.ts';
import { setupGame } from './game-flow.ts';

const ALPHA = planetId('alpha-1');
const BETA = planetId('beta-1');

function state(): GameState {
  const base = updatePlayer(setupGame(), RED, (player) => ({ ...player, tradeGoods: 3 }));
  const owned = (id: typeof ALPHA) => ({ id, controller: RED, exhausted: false, units: [] });
  return { ...base, planets: { ...base.planets, [ALPHA]: owned(ALPHA), [BETA]: owned(BETA) } };
}

const pay = (payment: Payment, currency: 'resources' | 'influence' = 'resources') =>
  evaluatePayment(state(), content.tiles, RED, payment, currency);

describe('Bezahlen mit Planeten und Handelswaren (RR 22.3, RR 65.3)', () => {
  it('Ressourcen bzw. Einfluss der Planeten plus Handelswaren', () => {
    expect(pay({ planets: [ALPHA, BETA], tradeGoods: 1 })).toEqual({ ok: true, value: 4 });
    expect(pay({ planets: [ALPHA, BETA], tradeGoods: 0 }, 'influence')).toEqual({
      ok: true,
      value: 3,
    });
  });

  it('jeder Planet nur einmal, nur eigene und bereite Planeten', () => {
    expect(pay({ planets: [ALPHA, ALPHA], tradeGoods: 0 })).toMatchObject({
      error: { code: 'payment.duplicatePlanet' },
    });
    expect(pay({ planets: [planetId('nirgendwo')], tradeGoods: 0 })).toMatchObject({
      error: { code: 'payment.unknownPlanet' },
    });
    expect(
      evaluatePayment(
        state(),
        content.tiles,
        BLUE,
        { planets: [ALPHA], tradeGoods: 0 },
        'influence',
      ),
    ).toMatchObject({ error: { code: 'planet.notControlled' } });
    const spent = evolveGame(state(), { type: 'PlanetsExhausted', player: RED, planets: [ALPHA] });
    expect(
      evaluatePayment(spent, content.tiles, RED, { planets: [ALPHA], tradeGoods: 0 }, 'resources'),
    ).toMatchObject({ error: { code: 'planet.alreadyExhausted' } });
  });

  it('Handelswaren: ganzzahlig, nicht negativ, nicht mehr als vorhanden', () => {
    for (const tradeGoods of [4, -1, 0.5]) {
      expect(pay({ planets: [], tradeGoods })).toMatchObject({
        error: { code: 'payment.tradeGoods' },
      });
    }
  });

  it('Events führen die Bezahlung aus', () => {
    expect(paymentEvents(RED, { planets: [], tradeGoods: 0 })).toEqual([]);
    const events = paymentEvents(RED, { planets: [ALPHA], tradeGoods: 2 });
    const after = events.reduce(evolveGame, state());
    expect(after.planets[ALPHA]?.exhausted).toBe(true);
    expect(after.players.find((p) => p.id === RED)?.tradeGoods).toBe(1);
  });

  it('erhaltene Handelswaren landen beim Spieler; unbekannte Planeten bleiben unberührt', () => {
    const gained = evolveGame(state(), { type: 'TradeGoodsGained', player: RED, amount: 2 });
    expect(gained.players.find((p) => p.id === RED)?.tradeGoods).toBe(5);
    const unknown = planetId('nirgendwo');
    const same = evolveGame(state(), { type: 'PlanetsExhausted', player: RED, planets: [unknown] });
    expect(same.planets[unknown]).toBeUndefined();
  });

  it('Planetendaten werden über die Systemkacheln gefunden', () => {
    expect(findPlanetDefinition(content.tiles, BETA)).toMatchObject({ influence: 2 });
    expect(findPlanetDefinition(content.tiles, planetId('x'))).toBeUndefined();
  });
});
