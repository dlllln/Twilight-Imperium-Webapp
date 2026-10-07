import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import type { Unit } from '../unit/unit.ts';

/** RR 62, RR 24: Neue Einheiten erscheinen im System; Bodentruppen auf einem Planeten. */
export interface UnitsProduced extends DomainEvent<'UnitsProduced'> {
  readonly player: PlayerId;
  readonly system: SystemId;
  readonly space: readonly Unit[];
  readonly planet: PlanetId | null;
  readonly ground: readonly Unit[];
}

export type ProductionEvent = UnitsProduced;
