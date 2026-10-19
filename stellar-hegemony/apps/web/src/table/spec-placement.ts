import type { GameCommand, PlanetId, Unit, UnitId } from '@stellar/domain';
import type { MessageKey } from '../i18n.ts';
import { bombardChoices, landingChoices } from '../invasion-view.ts';
import { content } from '../store.ts';
import {
  addCoins,
  ownTradeGoods,
  paymentOf,
  paymentPlan,
  paymentValueOf,
  spendableIds,
  togglePlanet,
} from './payment-draft.ts';
import { assign, assignedTo, assignmentsOf, assignNext, placementPlan } from './placement-draft.ts';
import { planetStates, type PlanetSide } from './planet-table.ts';
import type {
  PlacementPlan,
  Progress,
  SpecAlternative,
  SpecContext,
  TableAction,
  TablePiece,
  TableSpec,
} from './spec-types.ts';
import { SPACE, siteTarget, type TargetRef, targetKey, type TargetState } from './target-ref.ts';

/*
 * Bombardement (RR 20) und Landung (RR 25) am Tisch: Figuren werden auf Planeten gezogen, oder
 * ein Planet wird angetippt und bekommt die nächste freie Figur. Wer nicht zugewiesen ist, bleibt
 * im Weltraum. Landen auf der Thronwelt kostet Einfluss; das Siegel wartet, bis bezahlt ist.
 */

export type PlacementSpec = TableSpec<PlacementPlan, TableAction>;

/** Was eine Zuweisungs-Entscheidung von der Domain wissen muss. */
interface Choices {
  readonly units: readonly Unit[];
  readonly planets: readonly PlanetId[];
  /** Einfluss für die Thronwelt; `null` ohne Kosten. */
  readonly cost: number | null;
}

const bombardOf = (ctx: SpecContext): Choices => {
  const { ships, planets } = bombardChoices(ctx.game, content);
  return { units: ships, planets, cost: null };
};

const landingOf = (ctx: SpecContext): Choices => {
  const { forces, planets, centerCost } = landingChoices(ctx.game, content);
  return { units: forces, planets, cost: centerCost };
};

const unitIds = (choices: Choices): readonly UnitId[] => choices.units.map((unit) => unit.id);

/** Mit Kosten und mindestens einer Zuweisung ist eine Bezahlung offen, sonst keine. */
function withPayment(choices: Choices, plan: PlacementPlan): PlacementPlan {
  const paying = choices.cost !== null && Object.keys(plan.assignments).length > 0;
  if (paying === (plan.payment !== null)) return plan;
  return { ...plan, payment: paying ? paymentPlan('influence') : null };
}

/** Planeten und Münzen gehen nur in eine offene Bezahlung. */
function paying(ctx: SpecContext, plan: PlacementPlan, action: TableAction): PlacementPlan {
  const { payment } = plan;
  if (payment === null) return plan;
  if (action.kind === 'planet') {
    const offered = spendableIds(ctx.game, ctx.actor, 'influence');
    return { ...plan, payment: togglePlanet(payment, action.planet, offered) };
  }
  if (action.kind !== 'tradeGoods') return plan;
  return { ...plan, payment: addCoins(payment, action.delta, ownTradeGoods(ctx.game, ctx.actor)) };
}

function assigned(choices: Choices, plan: PlacementPlan, action: TableAction): PlacementPlan {
  if (action.kind === 'site')
    return assignNext(plan, unitIds(choices), action.planet, choices.planets);
  if (action.kind !== 'assign' || !unitIds(choices).includes(action.unit)) return plan;
  return assign(plan, action.unit, action.planet, choices.planets);
}

const applyWith =
  (of: (ctx: SpecContext) => Choices) =>
  (ctx: SpecContext, plan: PlacementPlan, action: TableAction): PlacementPlan => {
    const choices = of(ctx);
    if (action.kind === 'planet' || action.kind === 'tradeGoods') return paying(ctx, plan, action);
    return withPayment(choices, assigned(choices, plan, action));
  };

/** Die Bezahlung der Thronwelt in der Planetenreihe, solange sie offen ist. */
const planetsWith =
  (of: (ctx: SpecContext) => Choices) =>
  (ctx: SpecContext, plan: PlacementPlan): PlanetSide | null =>
    plan.payment === null
      ? null
      : {
          mode: 'pay',
          currency: 'influence',
          chosen: plan.payment.planets,
          offered: spendableIds(ctx.game, ctx.actor, 'influence'),
          limit: null,
          tradeGoods: plan.payment.tradeGoods,
          required: of(ctx).cost,
        };

/** Erlaubte Planeten leuchten, besetzte sind gewählt; dazu die Planeten der Bezahlung. */
const targetsWith =
  (of: (ctx: SpecContext) => Choices) =>
  (ctx: SpecContext, plan: PlacementPlan): ReadonlyMap<string, TargetState> => {
    const side = planetsWith(of)(ctx, plan);
    const states = new Map<string, TargetState>(side === null ? [] : planetStates(side));
    for (const planet of of(ctx).planets) states.set(targetKey(siteTarget(planet)), 'legal');
    for (const planet of Object.values(plan.assignments))
      states.set(targetKey(siteTarget(planet)), 'chosen');
    return states;
  };

/** Zugewiesene Figuren; mit offener Bezahlung erst bereit, wenn genug Einfluss liegt. */
const progressWith =
  (of: (ctx: SpecContext) => Choices) =>
  (ctx: SpecContext, plan: PlacementPlan): Progress => {
    const { cost, units } = of(ctx);
    if (plan.payment === null || cost === null) {
      const done = Object.keys(plan.assignments).length;
      return { done, needed: units.length, ready: true };
    }
    const paid = paymentValueOf(ctx.game, ctx.actor, plan.payment);
    return { done: paid, needed: cost, ready: paid >= cost };
  };

const piecesWith =
  (of: (ctx: SpecContext) => Choices) =>
  (ctx: SpecContext, plan: PlacementPlan): readonly TablePiece[] =>
    of(ctx).units.map((unit) => ({
      ref: { kind: 'unit', id: unit.id },
      type: unit.type,
      owner: unit.owner,
      at: assignedTo(plan, unit.id),
    }));

/** Eine Figur darf auf jeden erlaubten Planeten und, wenn sie zugewiesen ist, zurück ins All. */
const legalWith =
  (of: (ctx: SpecContext) => Choices) =>
  (ctx: SpecContext, plan: PlacementPlan, piece: TargetRef): ReadonlySet<string> => {
    const choices = of(ctx);
    if (piece.kind !== 'unit' || !unitIds(choices).includes(piece.id)) return new Set();
    const keys = choices.planets.map((planet) => targetKey(siteTarget(planet)));
    const back = assignedTo(plan, piece.id) === null ? [] : [targetKey(SPACE)];
    return new Set([...keys, ...back]);
  };

const anyAssigned = (plan: PlacementPlan): boolean => Object.keys(plan.assignments).length > 0;

interface PlacementConfig {
  readonly id: 'bombard' | 'landing';
  readonly hint: MessageKey;
  readonly skip: MessageKey;
  readonly go: MessageKey;
  readonly choices: (ctx: SpecContext) => Choices;
  readonly command: (ctx: SpecContext, plan: PlacementPlan | null) => GameCommand;
}

/** Der Ausweg ohne Zuweisung, sobald etwas zugewiesen ist (mit derselben Beschriftung). */
const skipOf =
  (config: PlacementConfig) =>
  (ctx: SpecContext, plan: PlacementPlan): SpecAlternative | null =>
    anyAssigned(plan) ? { label: config.skip, command: config.command(ctx, null) } : null;

function placementSpec(config: PlacementConfig): PlacementSpec {
  const of = config.choices;
  return {
    id: config.id,
    hint: () => config.hint,
    confirm: (_ctx, plan) => (anyAssigned(plan) ? config.go : config.skip),
    initial: placementPlan,
    apply: applyWith(of),
    targets: targetsWith(of),
    progress: progressWith(of),
    command: config.command,
    alternative: skipOf(config),
    planets: planetsWith(of),
    pieces: piecesWith(of),
    legal: legalWith(of),
  };
}

export const BOMBARD_SPEC: PlacementSpec = placementSpec({
  id: 'bombard',
  hint: 'tableHintBombard',
  skip: 'skipBombardment',
  go: 'bombard',
  choices: bombardOf,
  command: (ctx, plan) => ({
    type: 'Bombard',
    issuedBy: ctx.actor,
    targets: plan === null ? [] : assignmentsOf(plan),
  }),
});

export const LANDING_SPEC: PlacementSpec = placementSpec({
  id: 'landing',
  hint: 'tableHintLanding',
  skip: 'skipInvasion',
  go: 'land',
  choices: landingOf,
  command: (ctx, plan) => ({
    type: 'CommitGroundForces',
    issuedBy: ctx.actor,
    landings: plan === null ? [] : assignmentsOf(plan),
    centerPayment: plan?.payment == null ? null : paymentOf(plan.payment),
  }),
});
