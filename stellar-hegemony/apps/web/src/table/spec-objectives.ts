import {
  availableObjectives,
  type GameCommand,
  type ObjectiveCondition,
  type ObjectiveId,
  type ObjectiveOption,
  type Payment,
  scoringOptions,
} from '@stellar/domain';
import type { MessageKey } from '../i18n.ts';
import { content } from '../store.ts';
import {
  addCoins,
  ownTradeGoods,
  paymentOf,
  type PaymentPlan,
  paymentPlan,
  paymentValueOf,
  spendableIds,
  spendableValue,
  togglePlanet,
} from './payment-draft.ts';
import { planetStates, type PlanetSide } from './planet-table.ts';
import { strategyCommand } from './spec-pools.ts';
import type { ObjectivePlan, Progress, SpecContext, TableAction, TableSpec } from './spec-types.ts';
import { cardTarget, targetKey, type TargetState } from './target-ref.ts';

/*
 * Aufträge am Tisch: Wertung der Statusphase und Imperium (primär werten, sekundär ziehen).
 * Ein erfüllter Auftrag wird angetippt; Ausgabe-Aufträge öffnen die Bezahlung, Handelswaren-
 * Aufträge zahlen genau den Betrag.
 */

export type ObjectiveSpec = TableSpec<ObjectivePlan, TableAction>;

type Spend = Extract<ObjectiveCondition, { kind: 'spend' }>;

const NONE: ObjectivePlan = { kind: 'objective', objective: null, payment: null };

const spendOf = (objective: ObjectiveId | null): Spend | null => {
  const condition = content.objectives.find((entry) => entry.id === objective)?.condition;
  return condition?.kind === 'spend' ? condition : null;
};

/** Was der Spieler für eine Ausgabe höchstens aufbringen kann. */
function reachable(ctx: SpecContext, spend: Spend): number {
  return spend.currency === 'tradeGoods'
    ? ownTradeGoods(ctx.game, ctx.actor)
    : spendableValue(ctx.game, ctx.actor, spend.currency);
}

/** Ausgabe-Aufträge zählen nur, wenn der Spieler den Betrag aufbringen kann. */
function affordable(ctx: SpecContext, objective: ObjectiveId): boolean {
  const spend = spendOf(objective);
  return spend === null || reachable(ctx, spend) >= spend.amount;
}

/** Zu wertende Aufträge der Wertung: erfüllt, jetzt erlaubt und bezahlbar. */
const scorable = (ctx: SpecContext): readonly ObjectiveId[] =>
  metIds(ctx, scoringOptions(ctx.game, ctx.actor, content));

/** Imperium primär: erfüllte öffentliche Aufträge; sekundär keine. */
const imperialPublic = (ctx: SpecContext): readonly ObjectiveId[] =>
  ctx.route.ability === 'secondary'
    ? []
    : metIds(
        ctx,
        availableObjectives(ctx.game, ctx.actor, content).filter(
          (option) => option.definition.category === 'public',
        ),
      );

function metIds(ctx: SpecContext, options: readonly ObjectiveOption[]): readonly ObjectiveId[] {
  const met = options.filter((option) => option.met).map((option) => option.definition.id);
  return met.filter((id) => affordable(ctx, id));
}

/** Ausgaben in Ressourcen oder Einfluss öffnen eine Bezahlung; Handelswaren zahlt die Domain. */
function paymentFor(objective: ObjectiveId): PaymentPlan | null {
  const currency = spendOf(objective)?.currency;
  return currency === undefined || currency === 'tradeGoods' ? null : paymentPlan(currency);
}

/** Ein Auftrag wird gewählt; derselbe noch einmal oder `null` legt ihn zurück. */
function choose(draft: ObjectivePlan, objective: ObjectiveId | null, met: readonly ObjectiveId[]) {
  if (objective === null || objective === draft.objective) return NONE;
  if (!met.includes(objective)) return draft;
  return { ...NONE, objective, payment: paymentFor(objective) };
}

/** Planeten und Münzen gehen nur in eine offene Bezahlung. */
function paying(ctx: SpecContext, draft: ObjectivePlan, action: TableAction): ObjectivePlan {
  const { payment } = draft;
  if (payment === null) return draft;
  if (action.kind === 'planet') {
    const offered = spendableIds(ctx.game, ctx.actor, payment.currency);
    return { ...draft, payment: togglePlanet(payment, action.planet, offered) };
  }
  if (action.kind !== 'tradeGoods') return draft;
  const own = ownTradeGoods(ctx.game, ctx.actor);
  return { ...draft, payment: addCoins(payment, action.delta, own) };
}

const applyWith =
  (met: (ctx: SpecContext) => readonly ObjectiveId[]) =>
  (ctx: SpecContext, draft: ObjectivePlan, action: TableAction): ObjectivePlan =>
    action.kind === 'objective'
      ? choose(draft, action.objective, met(ctx))
      : paying(ctx, draft, action);

/** Die Bezahlung in der Planetenreihe, solange ein Ausgabe-Auftrag gewählt ist. */
function planets(ctx: SpecContext, draft: ObjectivePlan): PlanetSide | null {
  const { payment } = draft;
  if (payment === null) return null;
  return {
    mode: 'pay',
    currency: payment.currency,
    chosen: payment.planets,
    offered: spendableIds(ctx.game, ctx.actor, payment.currency),
    limit: null,
    tradeGoods: payment.tradeGoods,
    required: spendOf(draft.objective)?.amount ?? null,
  };
}

const targetsWith =
  (met: (ctx: SpecContext) => readonly ObjectiveId[]) =>
  (ctx: SpecContext, draft: ObjectivePlan): ReadonlyMap<string, TargetState> => {
    const side = planets(ctx, draft);
    const states = new Map<string, TargetState>(side === null ? [] : planetStates(side));
    for (const id of met(ctx)) states.set(targetKey(cardTarget(id)), 'legal');
    if (draft.objective !== null) states.set(targetKey(cardTarget(draft.objective)), 'chosen');
    return states;
  };

/**
 * Ohne Wahl gleich bereit; bei Ausgabe-Aufträgen erst, wenn genug bezahlt ist. Handelswaren-
 * Aufträge zahlen aus dem Vorrat: bereit nur, wenn er reicht.
 */
function progress(ctx: SpecContext, draft: ObjectivePlan): Progress {
  const spend = spendOf(draft.objective);
  if (spend === null) return { done: 0, needed: 0, ready: true };
  const value =
    draft.payment === null
      ? Math.min(reachable(ctx, spend), spend.amount)
      : paymentValueOf(ctx.game, ctx.actor, draft.payment);
  return { done: value, needed: spend.amount, ready: value >= spend.amount };
}

/** Die Bezahlung, wie die Domain sie erwartet; Handelswaren-Aufträge zahlen genau den Betrag. */
function sentPayment(draft: ObjectivePlan): Payment {
  if (draft.payment !== null) return paymentOf(draft.payment);
  const spend = spendOf(draft.objective);
  return { planets: [], tradeGoods: spend?.currency === 'tradeGoods' ? spend.amount : 0 };
}

function scoringCommand(ctx: SpecContext, draft: ObjectivePlan): GameCommand {
  const issuedBy = ctx.actor;
  const { objective } = draft;
  if (objective === null) return { type: 'EndScoring', issuedBy };
  return { type: 'ScoreObjective', issuedBy, objective, payment: sentPayment(draft) };
}

/** Wertung der Statusphase (RR 61): einen erfüllten Auftrag werten oder die Wertung beenden. */
export const SCORING_SPEC: ObjectiveSpec = {
  id: 'scoring',
  hint: (ctx) => (scorable(ctx).length > 0 ? 'tableHintScoring' : 'tableHintScoringNone'),
  confirm: (_ctx, draft) => (draft.objective === null ? 'doneScoring' : 'score'),
  initial: () => NONE,
  apply: applyWith(scorable),
  targets: targetsWith(scorable),
  progress,
  command: scoringCommand,
  alternative: (_ctx, draft) =>
    draft.objective === null
      ? null
      : { label: 'cancel', action: { kind: 'objective', objective: null } },
  planets,
};

const secondary = (ctx: SpecContext): boolean => ctx.route.ability === 'secondary';

function imperialHint(ctx: SpecContext): MessageKey {
  if (secondary(ctx)) return 'tableHintDrawSecret';
  return imperialPublic(ctx).length > 0 ? 'tableHintImperial' : 'tableHintImperialNone';
}

/** Imperium (RR 45): primär wahlweise einen öffentlichen Auftrag werten, sekundär ziehen. */
export const IMPERIAL_SPEC: ObjectiveSpec = {
  id: 'imperial',
  hint: imperialHint,
  confirm: (ctx) => (secondary(ctx) ? 'drawSecret' : 'confirm'),
  initial: () => NONE,
  apply: applyWith(imperialPublic),
  targets: targetsWith(imperialPublic),
  progress,
  command: (ctx, draft) =>
    strategyCommand(ctx, {
      mechanic: 'imperial',
      objective: secondary(ctx) ? null : draft.objective,
      payment: secondary(ctx) ? paymentOf(paymentPlan('resources')) : sentPayment(draft),
    }),
  alternative: (_ctx, draft) =>
    draft.objective === null
      ? null
      : { label: 'noObjective', action: { kind: 'objective', objective: null } },
  planets,
};
