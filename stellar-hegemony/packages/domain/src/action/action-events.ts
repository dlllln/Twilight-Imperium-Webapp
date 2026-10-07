import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { StrategyCardId } from '../strategy/strategy-card.ts';

/** RR 74: Karte wird erschöpft, danach dürfen die anderen reihum die Sekundärfähigkeit nutzen. */
export interface StrategicActionPerformed extends DomainEvent<'StrategicActionPerformed'> {
  readonly player: PlayerId;
  readonly card: StrategyCardId;
  readonly secondaryOrder: readonly PlayerId[];
}

export interface SecondaryResolved extends DomainEvent<'SecondaryResolved'> {
  readonly player: PlayerId;
  readonly paidStrategyToken: boolean;
}

export interface SecondaryDeclined extends DomainEvent<'SecondaryDeclined'> {
  readonly player: PlayerId;
}

export interface PlayerPassed extends DomainEvent<'PlayerPassed'> {
  readonly player: PlayerId;
}

/** Der Zug ist vorbei; `next` ist null, wenn alle gepasst haben. */
export interface TurnEnded extends DomainEvent<'TurnEnded'> {
  readonly player: PlayerId;
  readonly next: PlayerId | null;
}

export type ActionEvent =
  StrategicActionPerformed | SecondaryResolved | SecondaryDeclined | PlayerPassed | TurnEnded;
