import { type PlayerId, type UnitTypeId, unitId } from '../shared/ids.ts';
import type { Unit } from './unit.ts';

export interface UnitStackRequest {
  readonly type: UnitTypeId;
  readonly count: number;
}

/**
 * Vergibt fortlaufende Einheiten-Ids ab `next` (deterministisch für Replays).
 * Die Reducer erhöhen `GameState.nextUnitNumber` um die Zahl erzeugter Einheiten.
 */
export class UnitNumbering {
  constructor(private next: number) {}

  create(owner: PlayerId, stacks: readonly UnitStackRequest[]): readonly Unit[] {
    return stacks.flatMap((stack) =>
      Array.from({ length: stack.count }, () => ({
        id: unitId(`u${String(this.next++)}`),
        type: stack.type,
        owner,
        damaged: false,
      })),
    );
  }
}
