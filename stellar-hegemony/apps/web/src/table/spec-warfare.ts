import { warfareTokenSystems } from '@stellar/domain';
import { poolDraft } from './pool-draft.ts';
import {
  applyMove,
  currentPools,
  poolProgress,
  poolTargets,
  strategyCommand,
  tokenPlan,
} from './spec-pools.ts';
import type { PoolSpec, SpecContext, TableAction, TokenPlan } from './spec-types.ts';
import { systemTarget, targetKey, type TargetState } from './target-ref.ts';

const tokenSystems = (ctx: SpecContext) => warfareTokenSystems(ctx.game, ctx.actor);

/**
 * Ein System mit eigenem Marker wählen: der erste gewählte Marker kommt lose in die Schale.
 * Ein anderes System tauscht nur die Herkunft; die schon gelegte Verteilung bleibt liegen, und
 * es bleibt bei genau einem Marker mehr. Dasselbe System noch einmal ändert nichts.
 */
function apply(ctx: SpecContext, draft: TokenPlan, action: TableAction): TokenPlan {
  if (action.kind !== 'system') return applyMove(draft, action);
  if (action.system === draft.system || !tokenSystems(ctx).includes(action.system)) return draft;
  const loose = draft.pools.loose + (draft.system === null ? 1 : 0);
  return { ...draft, pools: { ...draft.pools, loose }, system: action.system };
}

function targets(ctx: SpecContext, draft: TokenPlan): ReadonlyMap<string, TargetState> {
  const map = poolTargets(draft);
  for (const system of tokenSystems(ctx)) map.set(targetKey(systemTarget(system)), 'legal');
  if (draft.system !== null) map.set(targetKey(systemTarget(draft.system)), 'chosen');
  return map;
}

/** Kriegsführung primär (RR 49.1/49.2); ohne eigenen Marker auf der Karte nur umverteilen. */
export const WARFARE_SPEC: PoolSpec = {
  id: 'warfare',
  hint: () => 'tableHintWarfare',
  confirm: (ctx) => (tokenSystems(ctx).length === 0 ? 'withoutToken' : 'confirm'),
  initial: (ctx) => tokenPlan(poolDraft(currentPools(ctx), 0, false, 'board')),
  apply,
  targets,
  progress: (ctx, draft) =>
    poolProgress(
      draft.system === null ? 0 : 1,
      draft,
      draft.system !== null || tokenSystems(ctx).length === 0,
    ),
  command: (ctx, draft) =>
    strategyCommand(ctx, {
      mechanic: 'warfare',
      system: draft.system,
      pools: draft.pools.pools,
      production: null,
    }),
};
