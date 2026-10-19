import { statusTokenGain } from '@stellar/domain';
import { poolDraft } from './pool-draft.ts';
import { applyMove, currentPools, poolProgress, poolTargets, tokenPlan } from './spec-pools.ts';
import type { PoolSpec } from './spec-types.ts';

/** Statusphase (RR 73.5): neue Marker aus der Schale legen, jeder Marker darf umziehen. */
export const TOKENS_SPEC: PoolSpec = {
  id: 'tokens',
  hint: () => 'tableHintTokens',
  confirm: () => 'confirm',
  initial: (ctx) =>
    tokenPlan(poolDraft(currentPools(ctx), statusTokenGain(ctx.game, ctx.actor), false)),
  apply: (_ctx, draft, action) => applyMove(draft, action),
  targets: (_ctx, draft) => poolTargets(draft),
  progress: (ctx, draft) => poolProgress(statusTokenGain(ctx.game, ctx.actor), draft),
  command: (ctx, draft) => ({
    type: 'AllocateCommandTokens',
    issuedBy: ctx.actor,
    pools: draft.pools.pools,
  }),
};
