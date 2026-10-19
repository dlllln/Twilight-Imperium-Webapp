import { diplomacyPlacements, diplomacySystems, type SystemId } from '@stellar/domain';
import { content } from '../store.ts';
import { strategyCommand } from './spec-pools.ts';
import type { GhostToken, SpecContext, SystemPlan, TableAction, TableSpec } from './spec-types.ts';
import { systemTarget, targetKey, type TargetState } from './target-ref.ts';

/*
 * Diplomatie primär (RR 21.2): ein System mit eigenem Planeten außerhalb des Zentrums antippen.
 * Die anderen legen dort einen Marker ab; als Vorschau stehen ihre Marker als Geister im System.
 * Gibt es kein solches System, nimmt die Domain `system: null` an.
 */

export type SystemSpec = TableSpec<SystemPlan, TableAction>;

const systemsOf = (ctx: SpecContext): readonly SystemId[] =>
  diplomacySystems(ctx.game, ctx.actor, content.tiles);

function apply(ctx: SpecContext, draft: SystemPlan, action: TableAction): SystemPlan {
  if (action.kind !== 'system' || !systemsOf(ctx).includes(action.system)) return draft;
  return { kind: 'system', system: action.system };
}

function targets(ctx: SpecContext, draft: SystemPlan): ReadonlyMap<string, TargetState> {
  const states = new Map<string, TargetState>();
  for (const system of systemsOf(ctx)) states.set(targetKey(systemTarget(system)), 'legal');
  if (draft.system !== null) states.set(targetKey(systemTarget(draft.system)), 'chosen');
  return states;
}

/** Die Marker, die die Domain im gewählten System ablegen würde, stehen als Geister dort. */
function ghosts(ctx: SpecContext, draft: SystemPlan): readonly GhostToken[] {
  const { system } = draft;
  if (system === null) return [];
  return diplomacyPlacements(ctx.game, system, ctx.actor).map(({ player }) => ({ system, player }));
}

const empty = (ctx: SpecContext): boolean => systemsOf(ctx).length === 0;

export const DIPLOMACY_PRIMARY_SPEC: SystemSpec = {
  id: 'diplomacyPrimary',
  hint: (ctx) => (empty(ctx) ? 'tableHintDiplomacyNone' : 'tableHintDiplomacyPrimary'),
  confirm: (ctx) => (empty(ctx) ? 'withoutSystem' : 'confirm'),
  initial: (ctx) => ({ kind: 'system', system: systemsOf(ctx)[0] ?? null }),
  apply,
  targets,
  progress: (ctx, draft) => ({
    done: draft.system === null ? 0 : 1,
    needed: empty(ctx) ? 0 : 1,
    ready: draft.system !== null || empty(ctx),
  }),
  command: (ctx, draft) =>
    strategyCommand(ctx, { mechanic: 'diplomacy', system: draft.system, planets: [] }),
  ghosts,
};
