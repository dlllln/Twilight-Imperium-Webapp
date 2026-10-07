import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { StrategyCardId } from './strategy-card.ts';

/** RR 76.2: Der Spieler nimmt die Karte und die darauf liegenden Handelswaren. */
export interface StrategyCardPicked extends DomainEvent<'StrategyCardPicked'> {
  readonly player: PlayerId;
  readonly card: StrategyCardId;
  readonly tradeGoods: number;
}

/** RR 76.3: Auf jede nicht gewählte Karte kommt 1 Handelsware. */
export interface TradeGoodsPlacedOnCards extends DomainEvent<'TradeGoodsPlacedOnCards'> {
  readonly cards: readonly StrategyCardId[];
}

export type StrategyEvent = StrategyCardPicked | TradeGoodsPlacedOnCards;
