import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlayerId, TechnologyId } from '../shared/ids.ts';

/** RR 80.10: Die Technologie gehört dem Spieler für den Rest der Partie. */
export interface TechnologyResearched extends DomainEvent<'TechnologyResearched'> {
  readonly player: PlayerId;
  readonly technology: TechnologyId;
}

/** RR 80.5: Starttechnologien der Fraktion; erhalten, nicht erforscht. */
export interface TechnologiesGranted extends DomainEvent<'TechnologiesGranted'> {
  readonly player: PlayerId;
  readonly technologies: readonly TechnologyId[];
}

export type TechnologyEvent = TechnologyResearched | TechnologiesGranted;
