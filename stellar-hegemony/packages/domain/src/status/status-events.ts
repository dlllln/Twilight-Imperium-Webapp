import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PoolCounts } from '../player/command-sheet.ts';
import type { PlayerId } from '../shared/ids.ts';

/** RR 73.1: Der Spieler wertet nichts mehr in dieser Statusphase. */
export interface ScoringFinished extends DomainEvent<'ScoringFinished'> {
  readonly player: PlayerId;
}

/** RR 73.4: Alle Kommandomarker vom Spielplan zurück in den Nachschub. */
export type CommandTokensCleared = DomainEvent<'CommandTokensCleared'>;

/** Beginn von RR 73.5: Marker erhalten und umverteilen, in Initiativreihenfolge. */
export type TokenStepReached = DomainEvent<'TokenStepReached'>;

/** RR 73.5: `gained` Marker aus dem Nachschub, danach die neue Verteilung. */
export interface CommandTokensAllocated extends DomainEvent<'CommandTokensAllocated'> {
  readonly player: PlayerId;
  readonly gained: number;
  readonly pools: PoolCounts;
}

/** RR 73.6–73.8: bereitmachen, reparieren, Strategiekarten zurücklegen. */
export type RoundEnded = DomainEvent<'RoundEnded'>;

export type StatusEvent =
  ScoringFinished | CommandTokensCleared | TokenStepReached | CommandTokensAllocated | RoundEnded;
