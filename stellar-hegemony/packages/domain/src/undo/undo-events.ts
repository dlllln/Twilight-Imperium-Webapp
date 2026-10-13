import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlayerId } from '../shared/ids.ts';

/**
 * Ein Spieler nimmt seinen letzten Schritt zurück. Das Event selbst ändert nichts am Zustand:
 * Beim Replay entfallen alle Events ab `fromVersion` (siehe `withoutUndone`). So bleibt der
 * Event-Strom unveränderlich, und trotzdem gilt der zurückgenommene Schritt nicht mehr.
 */
export interface StepUndone extends DomainEvent<'StepUndone'> {
  readonly player: PlayerId;
  /** Version vor dem zurückgenommenen Schritt (Position seines ersten Events im Strom). */
  readonly fromVersion: number;
}

export type UndoEvent = StepUndone;
