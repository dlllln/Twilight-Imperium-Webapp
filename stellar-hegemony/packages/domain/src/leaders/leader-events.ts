import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { LeaderId, PlayerId } from '../shared/ids.ts';
import type { OwnedLeader } from './leader-state.ts';

/** PoK Spielaufbau: Jeder Spieler erhält die Anführer seiner Fraktion. */
export interface LeadersAssigned extends DomainEvent<'LeadersAssigned'> {
  readonly player: PlayerId;
  readonly leaders: readonly OwnedLeader[];
}

/** Die Bedingung eines Kommandanten oder Helden ist erfüllt; er ist ab jetzt bereit. */
export interface LeaderUnlocked extends DomainEvent<'LeaderUnlocked'> {
  readonly player: PlayerId;
  readonly leader: LeaderId;
}

/** Komponentenaktion eines Anführers; `purged` heißt, er ist danach aus dem Spiel (Held). */
export interface LeaderUsed extends DomainEvent<'LeaderUsed'> {
  readonly player: PlayerId;
  readonly leader: LeaderId;
  readonly purged: boolean;
}

export type LeaderEvent = LeadersAssigned | LeaderUnlocked | LeaderUsed;
