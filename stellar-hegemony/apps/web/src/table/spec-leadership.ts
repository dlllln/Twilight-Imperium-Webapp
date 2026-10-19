import { type Payment, previewCommandTokens } from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { content } from '../store.ts';
import {
  addCoins,
  ownTradeGoods,
  paymentOf,
  type PaymentPlan,
  paymentPlan,
  spendableIds,
  togglePlanet,
} from './payment-draft.ts';
import { planetStates, type PlanetSide } from './planet-table.ts';
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
import type { TargetState } from './target-ref.ts';

/** Die Vorschau würfelt nicht; ein fester Zufall genügt für alle Aufrufe. */
const PREVIEW_RANDOM = new SeededRandom(0);

/** Fragt die Domain, wie viele Marker Einflussplaneten und Handelswaren bringen. */
function gainFor(ctx: SpecContext, influence: Payment): number {
  const card = content.strategyCards.find((candidate) => candidate.id === ctx.route.card);
  if (card === undefined) return 0;
  const context = { random: PREVIEW_RANDOM, now: 0, content };
  const input = { state: ctx.game, player: ctx.actor, card, context, influence };
  const preview = previewCommandTokens(input, ctx.route.ability ?? 'primary');
  return preview.ok ? preview.value : 0;
}

/** Jede Änderung der Bezahlung setzt die Verteilung zurück; alte Marker bleiben liegen. */
function fresh(ctx: SpecContext, plan: PaymentPlan): TokenPlan {
  const pools = poolDraft(currentPools(ctx), gainFor(ctx, paymentOf(plan)), true);
  return tokenPlan(pools, null, plan.tradeGoods, plan.planets);
}

/** Die Bezahlung der Führung als Einfluss-Entwurf. */
const influenceOf = (draft: TokenPlan): PaymentPlan => ({
  ...paymentPlan('influence'),
  planets: draft.planets,
  tradeGoods: draft.tradeGoods,
});

const influencePlanets = (ctx: SpecContext) => spendableIds(ctx.game, ctx.actor, 'influence');

function paidWith(ctx: SpecContext, plan: PaymentPlan, action: TableAction): PaymentPlan {
  if (action.kind === 'planet') return togglePlanet(plan, action.planet, influencePlanets(ctx));
  if (action.kind !== 'tradeGoods') return plan;
  return addCoins(plan, action.delta, ownTradeGoods(ctx.game, ctx.actor));
}

function apply(ctx: SpecContext, draft: TokenPlan, action: TableAction): TokenPlan {
  if (action.kind !== 'tradeGoods' && action.kind !== 'planet') return applyMove(draft, action);
  const before = influenceOf(draft);
  const after = paidWith(ctx, before, action);
  return after === before ? draft : fresh(ctx, after);
}

/** Einflussplaneten der Planetenreihe; Handelswaren zahlen mit. */
const planets = (ctx: SpecContext, draft: TokenPlan): PlanetSide => ({
  mode: 'pay',
  currency: 'influence',
  chosen: draft.planets,
  offered: influencePlanets(ctx),
  limit: null,
  tradeGoods: draft.tradeGoods,
  required: null,
});

function targets(ctx: SpecContext, draft: TokenPlan): ReadonlyMap<string, TargetState> {
  return new Map([...poolTargets(draft), ...planetStates(planets(ctx, draft))]);
}

/** Führung (RR 52): gewonnene Marker auf die Leisten, Einfluss aus Planeten und Handelswaren. */
export const LEADERSHIP_SPEC: PoolSpec = {
  id: 'leadership',
  hint: () => 'tableHintLeadership',
  confirm: () => 'confirm',
  initial: (ctx) => fresh(ctx, paymentPlan('influence')),
  apply,
  targets,
  progress: (_ctx, draft) =>
    poolProgress(poolSum(addedTokens(draft.pools)) + draft.pools.loose, draft),
  command: (ctx, draft) =>
    strategyCommand(ctx, {
      mechanic: 'commandTokens',
      influence: { planets: draft.planets, tradeGoods: draft.tradeGoods },
      allocation: addedTokens(draft.pools),
    }),
  planets,
};
