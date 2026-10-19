import { describe, expect, it } from 'vitest';
import {
  type GameState,
  type PlayerId,
  type StrategyCardDefinition,
  secondaryTokenCost,
  updatePlayer,
} from '../src/index.ts';
import { BLUE, CARD, RED, STRATEGY_CARDS } from './fixtures.ts';
import { actionPhaseGame, GREEN, run } from './game-flow.ts';

const definition = (initiative: number): StrategyCardDefinition => {
  const card = STRATEGY_CARDS.find((entry) => entry.id === CARD(initiative));
  if (card === undefined) throw new Error('Karte fehlt');
  return card;
};

/** Rot hält zusätzlich den Handel und spielt ihn mit Freibriefen für die genannten Spieler. */
function tradePlayed(freeFor: readonly PlayerId[]): GameState {
  const state = actionPhaseGame();
  const card = state.strategyCards[CARD(5)];
  if (card === undefined) throw new Error('Karte fehlt');
  const held = {
    ...state,
    strategyCards: { ...state.strategyCards, [card.id]: { ...card, holder: RED } },
  };
  const choice = { mechanic: 'trade', freeFor } as const;
  return run(held, [{ type: 'PerformStrategicAction', issuedBy: RED, card: card.id, choice }]);
}

describe('Kosten der Sekundärfähigkeit', () => {
  it('Sekundärfähigkeit kostet einen Strategiemarker', () => {
    expect(secondaryTokenCost(actionPhaseGame(), BLUE, definition(2))).toBe(1);
  });

  it('Führung ist kostenlos', () => {
    expect(secondaryTokenCost(actionPhaseGame(), BLUE, definition(1))).toBe(0);
  });

  it('ein Freibrief des Handels erlässt die Kosten', () => {
    const state = tradePlayed([GREEN]);
    expect(secondaryTokenCost(state, GREEN, definition(5))).toBe(0);
    expect(secondaryTokenCost(state, BLUE, definition(5))).toBe(1);
  });

  it('eine Fraktionsregel erlässt die Kosten ihrer Karte', () => {
    const state = updatePlayer(actionPhaseGame(), BLUE, (player) => ({
      ...player,
      factionRules: { ...player.factionRules, freeSecondaries: ['trade'] },
    }));
    expect(secondaryTokenCost(state, BLUE, definition(5))).toBe(0);
    expect(secondaryTokenCost(state, BLUE, definition(3))).toBe(1);
  });
});
