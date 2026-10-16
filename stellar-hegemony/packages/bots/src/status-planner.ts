import {
  type GameCommand,
  NO_PAYMENT,
  type ObjectiveDefinition,
  type Payment,
  type PoolCounts,
  scoringOptions,
  statusActor,
  statusTokenGain,
} from '@stellar/domain';
import { type BotView, contentOf, issued, me, type Planner } from './bot-view.ts';
import { planPayment } from './payment-planner.ts';

/** Ausgabe-Aufträge (RR 12.9) bezahlt der Bot gierig; andere kosten nichts. */
export function objectivePayment(view: BotView, definition: ObjectiveDefinition): Payment {
  const condition = definition.condition;
  if (condition.kind !== 'spend') return NO_PAYMENT;
  if (condition.currency === 'tradeGoods') return { planets: [], tradeGoods: condition.amount };
  return planPayment(view, condition.currency, condition.amount) ?? NO_PAYMENT;
}

/** Erfüllte Aufträge, die jetzt gewertet werden dürften. */
export const scoreCommands = (view: BotView): readonly GameCommand[] =>
  scoringOptions(view.state, view.player, contentOf(view))
    .filter((option) => option.met)
    .map(({ definition }) => ({
      type: 'ScoreObjective',
      ...issued(view),
      objective: definition.id,
      payment: objectivePayment(view, definition),
    }));

const FLEET_TARGET = 3;
const STRATEGY_TARGET = 2;

/** Neue Marker: zuerst Flotte und Strategie auffüllen, der Rest in die Taktik. */
export function gainSplit(pools: PoolCounts, gained: number): PoolCounts {
  const fleet = pools.fleet < FLEET_TARGET && gained > 0 ? 1 : 0;
  const strategy = pools.strategy < STRATEGY_TARGET && gained - fleet > 0 ? 1 : 0;
  return { tactic: gained - fleet - strategy, fleet, strategy };
}

export function splitGain(pools: PoolCounts, gained: number): PoolCounts {
  const added = gainSplit(pools, gained);
  return {
    tactic: pools.tactic + added.tactic,
    fleet: pools.fleet + added.fleet,
    strategy: pools.strategy + added.strategy,
  };
}

function allocations(view: BotView): readonly GameCommand[] {
  const gained = statusTokenGain(view.state, view.player);
  const pools = me(view).commandPools;
  return [splitGain(pools, gained), { ...pools, tactic: pools.tactic + gained }].map((next) => ({
    type: 'AllocateCommandTokens',
    ...issued(view),
    pools: next,
  }));
}

/** RR 73: werten und abschließen, danach Kommandomarker verteilen. */
export const statusPhase: Planner = (view) => {
  const status = view.state.statusPhase;
  if (view.state.phase !== 'status' || statusActor(view.state) !== view.player) return [];
  if (status?.step === 'tokens') return allocations(view);
  return [...scoreCommands(view), { type: 'EndScoring', ...issued(view) }];
};
