import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { CommandPool, PoolCounts } from '../player/command-sheet.ts';
import type { PlanetId, PlayerId, SystemId } from '../shared/ids.ts';

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

export interface PlanetsReadied extends DomainEvent<'PlanetsReadied'> {
  readonly player: PlayerId;
  readonly planets: readonly PlanetId[];
}

/** Woher ein Kommandomarker stammt: Nachschub oder ein Pool der Kommandotafel. */
export type TokenSource = 'reinforcements' | CommandPool;

export interface TokenPlacement {
  readonly player: PlayerId;
  readonly source: TokenSource;
}

/** Kommandomarker anderer Spieler landen in einem System (z. B. durch Diplomatie). */
export interface CommandTokensPlaced extends DomainEvent<'CommandTokensPlaced'> {
  readonly system: SystemId;
  readonly placements: readonly TokenPlacement[];
}

/** RR 23: Rohstoffe werden bis zum Rohstofflimit der Fraktion aufgefüllt. */
export interface CommoditiesReplenished extends DomainEvent<'CommoditiesReplenished'> {
  readonly player: PlayerId;
}

/** RR 49.1: ein eigener Marker wird vom Spielplan genommen und kommt auf die Kommandotafel. */
export interface CommandTokenReturned extends DomainEvent<'CommandTokenReturned'> {
  readonly player: PlayerId;
  readonly system: SystemId;
}

/** Neue Verteilung der Kommandotafel (inklusive eines zurückgenommenen Markers). */
export interface CommandTokensRedistributed extends DomainEvent<'CommandTokensRedistributed'> {
  readonly player: PlayerId;
  readonly pools: PoolCounts;
}

export type EconomyEvent =
  | CommandTokensGained
  | PlanetsExhausted
  | PlanetsReadied
  | TradeGoodsSpent
  | TradeGoodsGained
  | CommandTokensPlaced
  | CommoditiesReplenished
  | CommandTokenReturned
  | CommandTokensRedistributed;
