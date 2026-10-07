import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { CommandPool } from '../player/command-sheet.ts';
import type { AgendaId, PlanetId, PlayerId } from '../shared/ids.ts';
import type { EnactedLaw, OutcomeId } from './agenda-state.ts';

export interface AgendaDeckPrepared extends DomainEvent<'AgendaDeckPrepared'> {
  readonly deck: readonly AgendaId[];
}

export interface AgendaDeckReshuffled extends DomainEvent<'AgendaDeckReshuffled'> {
  readonly deck: readonly AgendaId[];
}

export type AgendaPhaseStarted = DomainEvent<'AgendaPhaseStarted'>;

export interface AgendaRevealed extends DomainEvent<'AgendaRevealed'> {
  readonly agenda: AgendaId;
  readonly number: number;
  readonly order: readonly PlayerId[];
}

export interface VotesCast extends DomainEvent<'VotesCast'> {
  readonly player: PlayerId;
  readonly outcome: OutcomeId;
  readonly planets: readonly PlanetId[];
  readonly votes: number;
}

export interface PlayerAbstained extends DomainEvent<'PlayerAbstained'> {
  readonly player: PlayerId;
}

export interface AgendaTied extends DomainEvent<'AgendaTied'> {
  readonly outcomes: readonly OutcomeId[];
}

export interface AgendaResolved extends DomainEvent<'AgendaResolved'> {
  readonly agenda: AgendaId;
  readonly outcome: OutcomeId;
}

export interface LawEnacted extends DomainEvent<'LawEnacted'> {
  readonly law: EnactedLaw;
}

export interface AgendaDiscarded extends DomainEvent<'AgendaDiscarded'> {
  readonly agenda: AgendaId;
}

export type LawsRepealed = DomainEvent<'LawsRepealed'>;

export interface CommandTokensLost extends DomainEvent<'CommandTokensLost'> {
  readonly player: PlayerId;
  readonly pool: CommandPool;
  readonly amount: number;
}

export type AgendaPhaseEnded = DomainEvent<'AgendaPhaseEnded'>;

export type AgendaEvent =
  | AgendaDeckPrepared
  | AgendaDeckReshuffled
  | AgendaPhaseStarted
  | AgendaRevealed
  | VotesCast
  | PlayerAbstained
  | AgendaTied
  | AgendaResolved
  | LawEnacted
  | AgendaDiscarded
  | LawsRepealed
  | CommandTokensLost
  | AgendaPhaseEnded;
