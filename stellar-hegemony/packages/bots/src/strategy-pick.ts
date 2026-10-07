import type { StrategyCardState, StrategyMechanic } from '@stellar/domain';
import { issued, type Planner } from './bot-view.ts';

/** Vorliebe der Bots: Punkte und Technologie zuerst, Diplomatie zuletzt. */
const PRIORITY: Readonly<Record<StrategyMechanic, number>> = {
  imperial: 8,
  technology: 7,
  warfare: 6,
  trade: 5,
  construction: 4,
  commandTokens: 3,
  politics: 2,
  diplomacy: 1,
};

/** RR 76.3: Handelswaren auf einer Karte machen sie attraktiver. */
const TRADE_GOOD_WEIGHT = 2;

const score = (card: StrategyCardState): number =>
  PRIORITY[card.mechanic] + card.tradeGoods * TRADE_GOOD_WEIGHT;

/** RR 76: eine freie Strategiekarte wählen, die attraktivste zuerst. */
export const pickStrategyCard: Planner = (view) => {
  const { state } = view;
  if (state.phase !== 'strategy' || state.pickQueue[0] !== view.player) return [];
  return Object.values(state.strategyCards)
    .filter((card) => card.holder === null)
    .sort((a, b) => score(b) - score(a))
    .map((card) => ({ type: 'PickStrategyCard', ...issued(view), card: card.id }));
};
