import type { HitAssignment, HitTarget, UnitId } from '@stellar/domain';

/*
 * Trefferstifte auf der Kampfmatte (reine Funktionen): Jedes Schiff trägt keinen, einen oder
 * zwei rote Stifte. Ein Stift heißt „Schaden abfangen“ (nur mit Schadensresistenz) oder
 * „zerstören“, zwei Stifte „Schaden abfangen und zerstören“. Mehr Stifte, als die Domain
 * verlangt, liegen nie.
 */

export type HitMark = 'none' | 'sustain' | 'destroy' | 'both';

export type HitMarks = Readonly<Record<string, HitMark>>;

const PEGS: Readonly<Record<HitMark, number>> = { none: 0, sustain: 1, destroy: 1, both: 2 };

/** Reihenfolge beim Antippen: mit Schadensresistenz vier Zustände, sonst zwei. */
const CYCLE_SUSTAINABLE: readonly HitMark[] = ['none', 'sustain', 'destroy', 'both'];
const CYCLE_PLAIN: readonly HitMark[] = ['none', 'destroy'];

export const pegsOf = (mark: HitMark): number => PEGS[mark];

/** Alle gelegten Stifte. */
export const placedPegs = (marks: HitMarks): number =>
  Object.values(marks).reduce((sum, mark) => sum + pegsOf(mark), 0);

const markOf = (sustained: boolean, destroyed: boolean): HitMark => {
  if (sustained) return destroyed ? 'both' : 'sustain';
  return destroyed ? 'destroy' : 'none';
};

/** Die Stifte des Vorschlags der Domain. */
export function marksFrom(suggestion: HitAssignment, units: readonly HitTarget[]): HitMarks {
  return Object.fromEntries(
    units.map(({ unit }) => [
      unit.id,
      markOf(suggestion.sustained.includes(unit.id), suggestion.destroyed.includes(unit.id)),
    ]),
  );
}

/** Der nächste Zustand beim Antippen, der noch in die verlangte Zahl passt. */
export function cycleMark(mark: HitMark, sustainable: boolean, free: number): HitMark {
  const cycle = sustainable ? CYCLE_SUSTAINABLE : CYCLE_PLAIN;
  const start = Math.max(0, cycle.indexOf(mark));
  const after = [...cycle.slice(start + 1), ...cycle.slice(0, start + 1)];
  return after.find((next) => pegsOf(next) - pegsOf(mark) <= free) ?? 'none';
}

/** Ein Stift mehr: Schaden abfangen, wenn möglich, sonst zerstören; voll bleibt voll. */
export function addPeg(mark: HitMark, sustainable: boolean): HitMark {
  if (mark === 'none') return sustainable ? 'sustain' : 'destroy';
  return sustainable && mark !== 'both' ? 'both' : mark;
}

const idsWith = (marks: HitMarks, wanted: readonly HitMark[]): UnitId[] =>
  Object.entries(marks).flatMap(([id, mark]) => (wanted.includes(mark) ? [id as UnitId] : []));

/** Was `AssignHits` erwartet: Schadensresistenz und Zerstörungen getrennt. */
export const assignmentOf = (marks: HitMarks): HitAssignment => ({
  sustained: idsWith(marks, ['sustain', 'both']),
  destroyed: idsWith(marks, ['destroy', 'both']),
});
