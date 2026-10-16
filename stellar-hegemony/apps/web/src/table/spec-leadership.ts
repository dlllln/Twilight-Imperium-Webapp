import { findPlayer, previewCommandTokens } from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { content } from '../store.ts';
import { addedTokens, poolDraft, poolSum } from './pool-draft.ts';
import {
  applyMove,
  currentPools,
  poolProgress,
  poolTargets,
  strategyCommand,
  tokenPlan,
} from './spec-pools.ts';
import type { PoolSpec, SpecContext, TableAction, TokenPlan } from './spec-types.ts';

/** Die Vorschau würfelt nicht; ein fester Zufall genügt für alle Aufrufe. */
const PREVIEW_RANDOM = new SeededRandom(0);

/** Fragt die Domain, wie viele Marker die Handelswaren bringen (keine doppelte Regel). */
function gainFor(ctx: SpecContext, tradeGoods: number): number {
  const card = content.strategyCards.find((candidate) => candidate.id === ctx.route.card);
  if (card === undefined) return 0;
  const context = { random: PREVIEW_RANDOM, now: 0, content };
  const influence = { planets: [], tradeGoods };
  const input = { state: ctx.game, player: ctx.actor, card, context, influence };
  const preview = previewCommandTokens(input, ctx.route.ability ?? 'primary');
  return preview.ok ? preview.value : 0;
}

/** Jede Änderung der Bezahlung setzt die Verteilung zurück; alte Marker bleiben liegen. */
const fresh = (ctx: SpecContext, tradeGoods: number): TokenPlan =>
  tokenPlan(poolDraft(currentPools(ctx), gainFor(ctx, tradeGoods), true), null, tradeGoods);

function apply(ctx: SpecContext, draft: TokenPlan, action: TableAction): TokenPlan {
  if (action.kind !== 'tradeGoods') return applyMove(draft, action);
  const own = findPlayer(ctx.game, ctx.actor)?.tradeGoods ?? 0;
  const next = Math.min(own, Math.max(0, draft.tradeGoods + action.delta));
  return next === draft.tradeGoods ? draft : fresh(ctx, next);
}

/** Führung (RR 52): gewonnene Marker auf die Leisten, Handelswaren als Einfluss. */
export const LEADERSHIP_SPEC: PoolSpec = {
  id: 'leadership',
  hint: 'tableHintLeadership',
  confirm: () => 'confirm',
  initial: (ctx) => fresh(ctx, 0),
  apply,
  targets: (_ctx, draft) => poolTargets(draft),
  progress: (_ctx, draft) =>
    poolProgress(poolSum(addedTokens(draft.pools)) + draft.pools.loose, draft),
  command: (ctx, draft) =>
    strategyCommand(ctx, {
      mechanic: 'commandTokens',
      influence: { planets: [], tradeGoods: draft.tradeGoods },
      allocation: addedTokens(draft.pools),
    }),
};
