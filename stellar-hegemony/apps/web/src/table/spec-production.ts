import {
  type GameCommand,
  isGroundForce,
  type ProductionRequest,
  type SystemId,
} from '@stellar/domain';
import { homeSystemOf } from '../card-view.ts';
import type { MessageKey } from '../i18n.ts';
import { tryCommand } from '../rules-preview.ts';
import { content } from '../store.ts';
import {
  addCoins,
  ownTradeGoods,
  paymentValueOf,
  spendableIds,
  togglePlanet,
} from './payment-draft.ts';
import { planetStates, type PlanetSide } from './planet-table.ts';
import { order, orderedCount, productionPlan, requestOf, withGround } from './production-draft.ts';
import { quoteValid, type Shipyard, shipyardFor } from './shipyard.ts';
import { currentPools, strategyCommand } from './spec-pools.ts';
import type {
  ProductionPlan,
  Progress,
  SpecAlternative,
  SpecContext,
  TableAction,
  TablePiece,
  TableSpec,
} from './spec-types.ts';
import {
  DOCK,
  siteTarget,
  systemTarget,
  type TargetRef,
  targetKey,
  type TargetState,
  yardPiece,
} from './target-ref.ts';

/*
 * Die Werft am Tisch (RR 62): Einheiten aus der Werft ins Dock legen, Bodentruppen auf einen
 * Planeten mit Produktion, bezahlen mit Planeten und Handelswaren. Dieselbe Entscheidung dient
 * der taktischen Produktion und der Kriegsführung (sekundär) im Heimatsystem.
 */

export type ProductionSpec = TableSpec<ProductionPlan, TableAction>;

const yardOf = (ctx: SpecContext, plan: ProductionPlan): Shipyard | null =>
  shipyardFor(ctx.game, ctx.actor, plan);

const costOf = (yard: Shipyard | null): number => yard?.quote.cost ?? 0;

/** Bestellen; ein Planet muss einer sein, auf den neue Bodentruppen dürfen. */
function ordered(
  yard: Shipyard,
  plan: ProductionPlan,
  action: Extract<TableAction, { readonly kind: 'order' }>,
): ProductionPlan {
  const { planet } = action;
  if (planet !== null && !yard.quote.groundPlanets.includes(planet)) return plan;
  return order(plan, yard.choices, action.type, action.delta, planet);
}

/** Planeten und Münzen gehen nur in eine Bezahlung, solange die Bestellung etwas kostet. */
function paid(ctx: SpecContext, yard: Shipyard, plan: ProductionPlan, action: TableAction) {
  const { payment } = plan;
  if (costOf(yard) === 0) return plan;
  if (action.kind === 'planet') {
    const offered = spendableIds(ctx.game, ctx.actor, 'resources');
    return { ...plan, payment: togglePlanet(payment, action.planet, offered) };
  }
  if (action.kind !== 'tradeGoods') return plan;
  return { ...plan, payment: addCoins(payment, action.delta, ownTradeGoods(ctx.game, ctx.actor)) };
}

function apply(ctx: SpecContext, plan: ProductionPlan, action: TableAction): ProductionPlan {
  const yard = yardOf(ctx, plan);
  if (yard === null) return plan;
  if (action.kind === 'order') return ordered(yard, plan, action);
  if (action.kind === 'site') return withGround(plan, action.planet, yard.quote.groundPlanets);
  return paid(ctx, yard, plan, action);
}

/** Die Bezahlung in der Planetenreihe, solange die Bestellung etwas kostet. */
function planets(ctx: SpecContext, plan: ProductionPlan): PlanetSide | null {
  const cost = costOf(yardOf(ctx, plan));
  if (cost === 0) return null;
  return {
    mode: 'pay',
    currency: 'resources',
    chosen: plan.payment.planets,
    offered: spendableIds(ctx.game, ctx.actor, 'resources'),
    limit: null,
    tradeGoods: plan.payment.tradeGoods,
    required: cost,
  };
}

/**
 * Das System der Werft als gewählt, dazu die Planeten der Bezahlung. Bauplätze bleiben weg:
 * Ihre Ringe lägen über den Ringen der Bezahlung.
 */
function targets(ctx: SpecContext, plan: ProductionPlan): ReadonlyMap<string, TargetState> {
  const side = planets(ctx, plan);
  const states = new Map<string, TargetState>(side === null ? [] : planetStates(side));
  if (plan.system !== null) states.set(targetKey(systemTarget(plan.system)), 'chosen');
  return states;
}

/** Bereit ohne Bestellung, sonst erst bezahlt, gültig und mit Planet für Bodentruppen. */
function ready(ctx: SpecContext, plan: ProductionPlan, yard: Shipyard | null): boolean {
  if (yard === null) return false;
  if (orderedCount(plan) === 0) return true;
  const enough = paymentValueOf(ctx.game, ctx.actor, plan.payment) >= yard.quote.cost;
  const ground = !yard.needsGround || yard.groundPlanet !== null;
  return enough && ground && quoteValid(yard);
}

/** Je baubarer Art ein Stück in der Werft. */
const pieces = (ctx: SpecContext, plan: ProductionPlan): readonly TablePiece[] =>
  (yardOf(ctx, plan)?.choices ?? []).map((choice) => ({
    ref: yardPiece(choice.unit.id),
    type: choice.unit.id,
    owner: ctx.actor,
    at: null,
  }));

/** Ein Stück darf ins Dock und ins System, Bodentruppen auch auf Planeten mit Produktion. */
function legal(ctx: SpecContext, plan: ProductionPlan, piece: TargetRef): ReadonlySet<string> {
  const yard = yardOf(ctx, plan);
  if (piece.kind !== 'yard' || yard === null) return new Set();
  const choice = yard.choices.find((entry) => entry.unit.id === piece.type);
  if (choice?.canAdd !== true) return new Set();
  const base = [targetKey(DOCK), targetKey(systemTarget(yard.system))];
  const sites = isGroundForce(choice.unit) ? yard.quote.groundPlanets : [];
  return new Set([...base, ...sites.map((planet) => targetKey(siteTarget(planet)))]);
}

const requestFor = (ctx: SpecContext, plan: ProductionPlan): ProductionRequest => {
  const yard = yardOf(ctx, plan);
  return requestOf(plan, yard?.groundPlanet ?? null, yard?.needsGround ?? false);
};

interface YardConfig {
  readonly id: 'production' | 'warfareSecondary';
  readonly hint: MessageKey;
  readonly skip: MessageKey;
  readonly system: (ctx: SpecContext) => SystemId | null;
  readonly command: (ctx: SpecContext, request: ProductionRequest) => GameCommand;
  /** Der Ausweg ohne Bau neben dem Siegel; `false` lässt den üblichen Ausweg (Ablehnen). */
  readonly skipAside: boolean;
}

const commandOf = (config: YardConfig, ctx: SpecContext, plan: ProductionPlan): GameCommand =>
  config.command(ctx, requestFor(ctx, plan));

/**
 * Einheiten im Dock / Produktionswert. Bereit erst, wenn die Domain den fertigen Befehl annimmt:
 * Flottenlimit und Kapazität prüft sie erst nach dem Bau, die Werft davor nicht. Auch der leere
 * Befehl wird erprobt: Die Kriegsführung braucht selbst ohne Bestellung eine Produktionseinheit.
 */
const progressOf =
  (config: YardConfig) =>
  (ctx: SpecContext, plan: ProductionPlan): Progress => {
    const yard = yardOf(ctx, plan);
    const needed = yard?.quote.limit ?? 0;
    const done = orderedCount(plan);
    const valid = ready(ctx, plan, yard);
    const probed = valid && tryCommand(ctx.game, commandOf(config, ctx, plan)).ok;
    return { done, needed, ready: probed };
  };

const NOTHING: ProductionRequest = requestOf(productionPlan(null), null, false);

/** Mit Bestellung bleibt „ohne Bau“ als Ausweg neben dem Siegel. */
const skipOf =
  (config: YardConfig) =>
  (ctx: SpecContext, plan: ProductionPlan): SpecAlternative | null =>
    config.skipAside && orderedCount(plan) > 0
      ? { label: config.skip, command: config.command(ctx, NOTHING) }
      : null;

function yardSpec(config: YardConfig): ProductionSpec {
  return {
    id: config.id,
    hint: () => config.hint,
    confirm: (_ctx, plan) => (orderedCount(plan) === 0 ? config.skip : 'produce'),
    initial: (ctx) => productionPlan(config.system(ctx)),
    apply,
    targets,
    progress: progressOf(config),
    command: (ctx, plan) => commandOf(config, ctx, plan),
    alternative: skipOf(config),
    planets,
    pieces,
    legal,
  };
}

/** Taktische Aktion, Schritt Produktion: im aktivierten System. */
export const PRODUCTION_SPEC: ProductionSpec = yardSpec({
  id: 'production',
  hint: 'tableHintProduction',
  skip: 'skipProduction',
  system: (ctx) => ctx.game.actionPhase?.tactical?.system ?? null,
  command: (ctx, request) => ({ type: 'ProduceUnits', issuedBy: ctx.actor, ...request }),
  skipAside: true,
});

/** Kriegsführung sekundär: im Heimatsystem, ohne es zu aktivieren; die Marker bleiben liegen. */
export const WARFARE_SECONDARY_SPEC: ProductionSpec = yardSpec({
  id: 'warfareSecondary',
  hint: 'tableHintWarfareSecondary',
  skip: 'finishWithoutBuilding',
  system: (ctx) => homeSystemOf(ctx.game, ctx.actor, content),
  command: (ctx, production) =>
    strategyCommand(ctx, {
      mechanic: 'warfare',
      system: null,
      pools: currentPools(ctx),
      production,
    }),
  skipAside: false,
});
