import type { PlayerId, UnitId, UnitTypeId } from '../shared/ids.ts';

/** Eine konkrete Einheit auf dem Spielplan. Beschädigt = Schadensresistenz verbraucht. */
export interface Unit {
  readonly id: UnitId;
  readonly type: UnitTypeId;
  readonly owner: PlayerId;
  readonly damaged: boolean;
}

export const unitsOwnedBy = (units: readonly Unit[], owner: PlayerId): readonly Unit[] =>
  units.filter((unit) => unit.owner === owner);

export const damageUnit = (unit: Unit): Unit => ({ ...unit, damaged: true });

export const repairUnit = (unit: Unit): Unit => ({ ...unit, damaged: false });
