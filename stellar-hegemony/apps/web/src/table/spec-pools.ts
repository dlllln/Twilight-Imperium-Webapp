import {
  COMMAND_POOLS,
  findPlayer,
  type GameCommand,
  type PlanetId,
  type PoolCounts,
  type StrategyChoice,
  strategyCardId,
  type SystemId,
} from '@stellar/domain';
import { moveToken, type PoolDraft } from './pool-draft.ts';
import type { Progress, SpecContext, TableAction, TokenPlan } from './spec-types.ts';
import { poolTarget, targetKey, type TargetState } from './target-ref.ts';

/* Bausteine, die alle Markerverteilungen am Tisch teilen. */

const NO_POOLS: PoolCounts = { tactic: 0, fleet: 0, strategy: 0 };

/** Die Leisten des Handelnden, wie sie gerade liegen. */
export const currentPools = (ctx: SpecContext): PoolCounts =>
  findPlayer(ctx.game, ctx.actor)?.commandPools ?? NO_POOLS;

export const tokenPlan = (
  pools: PoolDraft,
  system: SystemId | null = null,
  tradeGoods = 0,
  planets: readonly PlanetId[] = [],
): TokenPlan => ({ kind: 'tokens', pools, tradeGoods, planets, system });

/** Einen Marker umlegen; andere Aktionen ändern den Entwurf hier nicht. */
export const applyMove = (draft: TokenPlan, action: TableAction): TokenPlan =>
  action.kind === 'move'
    ? { ...draft, pools: moveToken(draft.pools, action.from, action.to) }
    : draft;

/** Solange Marker in der Schale liegen, laden alle Leisten zum Ablegen ein. */
export function poolTargets(draft: TokenPlan): Map<string, TargetState> {
  const open = draft.pools.loose > 0;
  return new Map(open ? COMMAND_POOLS.map((pool) => [targetKey(poolTarget(pool)), 'legal']) : []);
}

/** Fertig, sobald die Schale leer ist (und die übrigen Bedingungen gelten). */
export const poolProgress = (needed: number, draft: TokenPlan, other = true): Progress => ({
  needed,
  done: Math.max(0, needed - draft.pools.loose),
  ready: draft.pools.loose === 0 && other,
});

/** Primär als strategische Aktion der gewählten Karte, sekundär als Antwort im Fenster. */
export function strategyCommand(ctx: SpecContext, choice: StrategyChoice): GameCommand {
  const issuedBy = ctx.actor;
  if (ctx.route.ability === 'secondary') return { type: 'ResolveSecondary', issuedBy, choice };
  const card = ctx.route.card ?? strategyCardId('');
  return { type: 'PerformStrategicAction', issuedBy, card, choice };
}
