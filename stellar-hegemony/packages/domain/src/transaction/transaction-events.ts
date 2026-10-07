import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { Goods } from './goods.ts';

/** RR 82.4: Der aktive Spieler schlägt einem Nachbarn einen Tausch vor. */
export interface TransactionProposed extends DomainEvent<'TransactionProposed'> {
  readonly from: PlayerId;
  readonly to: PlayerId;
  readonly offer: Goods;
  readonly request: Goods;
}

/** Beide sind sich einig; Rohstoffe werden beim Empfänger zu Handelswaren (RR 50). */
export interface TransactionCompleted extends DomainEvent<'TransactionCompleted'> {
  readonly from: PlayerId;
  readonly to: PlayerId;
  readonly offer: Goods;
  readonly request: Goods;
}

export interface TransactionRejected extends DomainEvent<'TransactionRejected'> {
  readonly from: PlayerId;
  readonly to: PlayerId;
}

export type TransactionEvent = TransactionProposed | TransactionCompleted | TransactionRejected;
