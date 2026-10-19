import { describe, expect, it } from 'vitest';
import {
  type Currency,
  evaluatePayment,
  evolveGame,
  type GameState,
  type PlanetId,
  planetId,
  readyablePlanets,
  spendablePlanets,
} from '../src/index.ts';
import { BLUE, content, RED } from './fixtures.ts';
import { setupGame } from './game-flow.ts';

const ALPHA = planetId('alpha-1');
const BETA = planetId('beta-1');

/** Rot hält Alpha und Beta zusätzlich zur Heimatwelt; Beta ist erschöpft. */
function state(): GameState {
  const base = setupGame();
  const owned = (id: PlanetId, exhausted: boolean) => ({
    id,
    controller: RED,
    exhausted,
    units: [],
  });
  return {
    ...base,
    planets: { ...base.planets, [ALPHA]: owned(ALPHA, false), [BETA]: owned(BETA, true) },
  };
}

const owned = (game: GameState, exhausted: boolean): readonly PlanetId[] =>
  Object.values(game.planets)
    .filter((planet) => planet.controller === RED && planet.exhausted === exhausted)
    .map((planet) => planet.id);

const valueOf = (game: GameState, planet: PlanetId, currency: Currency): number => {
  const value = evaluatePayment(
    game,
    content.tiles,
    RED,
    { planets: [planet], tradeGoods: 0 },
    currency,
  );
  return value.ok ? value.value : -1;
};

describe('Abfragen für Planeten', () => {
  it('bezahlbar sind nur eigene bereite Planeten, mit dem Wert, den die Bezahlung zählt', () => {
    const game = state();
    for (const currency of ['resources', 'influence'] as const) {
      const spendable = spendablePlanets(game, content.tiles, RED, currency);
      expect(spendable.map((entry) => entry.planet).sort()).toEqual([...owned(game, false)].sort());
      for (const entry of spendable)
        expect(entry.value).toBe(valueOf(game, entry.planet, currency));
    }
    expect(
      spendablePlanets(game, content.tiles, RED, 'resources').map((e) => e.planet),
    ).not.toContain(BETA);
    const blue = spendablePlanets(game, content.tiles, BLUE, 'influence').map((e) => e.planet);
    expect(blue).not.toContain(ALPHA);
  });

  it('bereitmachen lassen sich nur eigene erschöpfte Planeten', () => {
    const game = state();
    expect(readyablePlanets(game, RED)).toEqual([BETA]);
    const spent = evolveGame(game, { type: 'PlanetsExhausted', player: RED, planets: [ALPHA] });
    expect([...readyablePlanets(spent, RED)].sort()).toEqual([ALPHA, BETA].sort());
    expect(readyablePlanets(spent, BLUE)).toEqual([]);
  });
});
