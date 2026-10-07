import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PoolCounts } from '../player/command-sheet.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';

/** Marker kommen aus dem Nachschub in die Pools der Kommandotafel (RR 46.2). */
export interface CommandTokensGained extends DomainEvent<'CommandTokensGained'> {
  readonly player: PlayerId;
  readonly pools: PoolCounts;
}

export interface PlanetsExhausted extends DomainEvent<'PlanetsExhausted'> {
  readonly player: PlayerId;
  readonly planets: readonly PlanetId[];
}

export interface TradeGoodsSpent extends DomainEvent<'TradeGoodsSpent'> {
  readonly player: PlayerId;
  readonly amount: number;
}

export interface TradeGoodsGained extends DomainEvent<'TradeGoodsGained'> {
  readonly player: PlayerId;
  readonly amount: number;
}

export type EconomyEvent =
  CommandTokensGained | PlanetsExhausted | TradeGoodsSpent | TradeGoodsGained;
