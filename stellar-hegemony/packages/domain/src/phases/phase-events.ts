import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { StrategyCardId, StrategyMechanic } from '../strategy/strategy-card.ts';

export interface StartingCard {
  readonly id: StrategyCardId;
  readonly initiative: number;
  readonly mechanic: StrategyMechanic;
}

/** Aufbau abgeschlossen: Sprecher steht fest, Strategiekarten liegen aus. */
export interface GameStarted extends DomainEvent<'GameStarted'> {
  readonly speaker: PlayerId;
  readonly strategyCards: readonly StartingCard[];
}

/** RR 76.2: Reihenfolge der Kartenwahl, bei wenigen Spielern zwei Durchgänge. */
export interface StrategyPhaseStarted extends DomainEvent<'StrategyPhaseStarted'> {
  readonly round: number;
  readonly pickQueue: readonly PlayerId[];
}

export interface ActionPhaseStarted extends DomainEvent<'ActionPhaseStarted'> {
  readonly order: readonly PlayerId[];
}

export interface StatusPhaseStarted extends DomainEvent<'StatusPhaseStarted'> {
  readonly round: number;
}

export type PhaseEvent =
  GameStarted | StrategyPhaseStarted | ActionPhaseStarted | StatusPhaseStarted;
