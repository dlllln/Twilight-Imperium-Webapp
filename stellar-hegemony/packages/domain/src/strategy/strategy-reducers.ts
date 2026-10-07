import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { StrategyCardState } from './strategy-card.ts';
import type {
  StrategyCardPicked,
  StrategyEvent,
  TradeGoodsPlacedOnCards,
} from './strategy-events.ts';

export function updateCard(
  state: GameState,
  id: string,
  update: (card: StrategyCardState) => StrategyCardState,
): GameState {
  const card = state.strategyCards[id];
  return card === undefined
    ? state
    : { ...state, strategyCards: { ...state.strategyCards, [id]: update(card) } };
}

function pick(state: GameState, event: StrategyCardPicked): GameState {
  const withCard = updateCard(state, event.card, (card) => ({
    ...card,
    holder: event.player,
    tradeGoods: 0,
  }));
  const withGoods = updatePlayer(withCard, event.player, (p) => ({
    ...p,
    tradeGoods: p.tradeGoods + event.tradeGoods,
  }));
  return { ...withGoods, pickQueue: withGoods.pickQueue.slice(1) };
}

function placeTradeGoods(state: GameState, event: TradeGoodsPlacedOnCards): GameState {
  return event.cards.reduce(
    (current, id) =>
      updateCard(current, id, (card) => ({ ...card, tradeGoods: card.tradeGoods + 1 })),
    state,
  );
}

export const strategyReducers: ReducerMap<GameState, StrategyEvent> = {
  StrategyCardPicked: pick,
  TradeGoodsPlacedOnCards: placeTradeGoods,
};
