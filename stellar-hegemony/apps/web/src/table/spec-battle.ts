import {
  type HitChoice,
  hitChoice,
  retreatChoice,
  type SystemId,
  technologyCatalog,
  type UnitId,
} from '@stellar/domain';
import { content } from '../store.ts';
import {
  addPeg,
  assignmentOf,
  cycleMark,
  type HitMark,
  marksFrom,
  placedPegs,
} from './hit-draft.ts';
import type {
  HitPlan,
  SpecAlternative,
  SpecContext,
  SystemPlan,
  TableAction,
  TableSpec,
} from './spec-types.ts';
import {
  systemTarget,
  type TargetRef,
  targetKey,
  type TargetState,
  unitTarget,
} from './target-ref.ts';

/*
 * Die Kampfmatte (RR 63, RR 89.1, RR 66): Treffer werden als rote Stifte auf die eigenen Schiffe
 * gelegt, vorbelegt mit dem Vorschlag der Domain; Antippen schaltet ein Schiff weiter. Beim
 * Rückzug (RR 63.5) leuchten die erlaubten Systeme auf der Karte; ein Antippen merkt eines vor,
 * das Siegel kündigt den Rückzug an oder kämpft weiter. Was erlaubt ist, sagt allein die Domain.
 */

export type HitSpec = TableSpec<HitPlan, TableAction>;
export type RetreatSpec = TableSpec<SystemPlan, TableAction>;

const catalogOf = (ctx: SpecContext) => technologyCatalog(ctx.game, content);

/** Die offene Trefferzuweisung; ohne sie (abgelöster Stand) nichts zu verteilen. */
const choiceOf = (ctx: SpecContext): HitChoice | null =>
  hitChoice(ctx.game, ctx.actor, catalogOf(ctx));

const requiredOf = (ctx: SpecContext): number => choiceOf(ctx)?.required ?? 0;

const suggested = (ctx: SpecContext): HitPlan => {
  const choice = choiceOf(ctx);
  return { kind: 'hits', marks: choice === null ? {} : marksFrom(choice.suggestion, choice.units) };
};

const sustainableOf = (ctx: SpecContext, unit: UnitId): boolean | null => {
  const target = choiceOf(ctx)?.units.find((entry) => entry.unit.id === unit);
  return target === undefined ? null : target.sustainable;
};

type Step = (mark: HitMark, sustainable: boolean, free: number) => HitMark;

/** Ändert die Stifte eines Schiffs; mehr als verlangt werden es nie. */
function withMark(ctx: SpecContext, draft: HitPlan, unit: UnitId, next: Step): HitPlan {
  const sustainable = sustainableOf(ctx, unit);
  if (sustainable === null) return draft;
  const mark = draft.marks[unit] ?? 'none';
  const free = requiredOf(ctx) - placedPegs(draft.marks);
  const changed = next(mark, sustainable, free);
  const fits = placedPegs({ ...draft.marks, [unit]: changed }) <= requiredOf(ctx);
  return fits ? { ...draft, marks: { ...draft.marks, [unit]: changed } } : draft;
}

const addOne: Step = (mark, sustainable) => addPeg(mark, sustainable);

function applyHits(ctx: SpecContext, draft: HitPlan, action: TableAction): HitPlan {
  if (action.kind === 'suggest') return suggested(ctx);
  if (action.kind === 'hit') return withMark(ctx, draft, action.unit, cycleMark);
  return action.kind === 'peg' ? withMark(ctx, draft, action.unit, addOne) : draft;
}

/** Schiffe mit Stiften sind gewählt; solange Stifte fehlen, sind die übrigen erlaubt. */
function hitTargets(ctx: SpecContext, draft: HitPlan): ReadonlyMap<string, TargetState> {
  const open = placedPegs(draft.marks) < requiredOf(ctx);
  const states = new Map<string, TargetState>();
  for (const { unit } of choiceOf(ctx)?.units ?? []) {
    const marked = (draft.marks[unit.id] ?? 'none') !== 'none';
    if (marked || open) states.set(targetKey(unitTarget(unit.id)), marked ? 'chosen' : 'legal');
  }
  return states;
}

/** Ein Stift darf auf jedes Schiff, das noch einen mehr nimmt, solange Stifte fehlen. */
function pegTargets(ctx: SpecContext, draft: HitPlan, piece: TargetRef): ReadonlySet<string> {
  if (piece.kind !== 'peg' || placedPegs(draft.marks) >= requiredOf(ctx)) return new Set();
  const takes = (choiceOf(ctx)?.units ?? []).filter(({ unit, sustainable }) => {
    const mark = draft.marks[unit.id] ?? 'none';
    return addPeg(mark, sustainable) !== mark;
  });
  return new Set(takes.map(({ unit }) => targetKey(unitTarget(unit.id))));
}

const SUGGEST: SpecAlternative = { label: 'hitSuggestion', action: { kind: 'suggest' } };

export const HITS_SPEC: HitSpec = {
  id: 'hits',
  hint: () => 'tableHintHits',
  confirm: () => 'confirmHits',
  initial: suggested,
  apply: applyHits,
  targets: hitTargets,
  progress: (ctx, draft) => {
    const done = placedPegs(draft.marks);
    const needed = requiredOf(ctx);
    return { done, needed, ready: done === needed };
  },
  command: (ctx, draft) => ({
    type: 'AssignHits',
    issuedBy: ctx.actor,
    ...assignmentOf(draft.marks),
  }),
  alternative: () => SUGGEST,
  legal: pegTargets,
};

const retreatsOf = (ctx: SpecContext): readonly SystemId[] =>
  retreatChoice(ctx.game, ctx.actor, catalogOf(ctx));

/** Ein erlaubtes System vormerken; ein zweites Antippen nimmt die Wahl zurück. */
function applyRetreat(ctx: SpecContext, draft: SystemPlan, action: TableAction): SystemPlan {
  if (action.kind !== 'system' || !retreatsOf(ctx).includes(action.system)) return draft;
  return { kind: 'system', system: draft.system === action.system ? null : action.system };
}

function retreatTargets(ctx: SpecContext, draft: SystemPlan): ReadonlyMap<string, TargetState> {
  const states = new Map<string, TargetState>();
  for (const system of retreatsOf(ctx))
    states.set(targetKey(systemTarget(system)), system === draft.system ? 'chosen' : 'legal');
  return states;
}

/** Mit vorgemerktem Ziel bleibt „Weiterkämpfen“ der Ausweg neben dem Siegel. */
function fightOn(ctx: SpecContext, draft: SystemPlan): SpecAlternative | null {
  if (draft.system === null) return null;
  return { label: 'fightOn', command: { type: 'DeclareRetreat', issuedBy: ctx.actor, to: null } };
}

export const RETREAT_SPEC: RetreatSpec = {
  id: 'retreat',
  hint: () => 'tableHintRetreat',
  confirm: (_ctx, draft) => (draft.system === null ? 'fightOn' : 'announceRetreat'),
  initial: () => ({ kind: 'system', system: null }),
  apply: applyRetreat,
  targets: retreatTargets,
  progress: (_ctx, draft) => ({ done: draft.system === null ? 0 : 1, needed: 0, ready: true }),
  command: (ctx, draft) => ({ type: 'DeclareRetreat', issuedBy: ctx.actor, to: draft.system }),
  alternative: fightOn,
};
