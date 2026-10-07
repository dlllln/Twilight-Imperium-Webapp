import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { ActionPhaseState } from '../phases/turn-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { Goods } from './goods.ts';
import type { TransactionCompleted, TransactionEvent } from './transaction-events.ts';

const withTurn = (state: GameState, change: (turn: ActionPhaseState) => ActionPhaseState) =>
  state.actionPhase === null ? state : { ...state, actionPhase: change(state.actionPhase) };

/** Geber verliert Handelswaren und Rohstoffe; der Empfänger erhält alles als Handelswaren. */
function hand(state: GameState, giver: PlayerId, receiver: PlayerId, goods: Goods): GameState {
  const given = updatePlayer(state, giver, (p) => ({
    ...p,
    tradeGoods: p.tradeGoods - goods.tradeGoods,
    commodities: p.commodities - goods.commodities,
  }));
  return updatePlayer(given, receiver, (p) => ({
    ...p,
    tradeGoods: p.tradeGoods + goods.tradeGoods + goods.commodities,
  }));
}

function complete(state: GameState, event: TransactionCompleted): GameState {
  const exchanged = hand(
    hand(state, event.from, event.to, event.offer),
    event.to,
    event.from,
    event.request,
  );
  return withTurn(exchanged, (turn) => ({
    ...turn,
    transaction: null,
    transactedWith: [...turn.transactedWith, event.to],
  }));
}

export const transactionReducers: ReducerMap<GameState, TransactionEvent> = {
  TransactionProposed: (state, { from, to, offer, request }) =>
    withTurn(state, (turn) => ({ ...turn, transaction: { from, to, offer, request } })),
  TransactionCompleted: complete,
  TransactionRejected: (state) => withTurn(state, (turn) => ({ ...turn, transaction: null })),
};
