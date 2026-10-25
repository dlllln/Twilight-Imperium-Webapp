import {
  type DomainError,
  domainError,
  err,
  type GameState,
  NO_PAYMENT,
  type PlanetId,
  type ResearchOption,
  researchCost,
  researchEvents,
  researchOptions,
  type Result,
  type SpecialtyPlanet,
  specialtyPlanets,
  type TechnologyColor,
  type TechnologyId,
} from '@stellar/domain';
import { content } from '../store.ts';
import {
  addCoins,
  ownTradeGoods,
  paymentOf,
  paymentValueOf,
  spendableIds,
  togglePlanet,
} from './payment-draft.ts';
import { planetStates, type PlanetSide } from './planet-table.ts';
import {
  researchPlan,
  researchRequest,
  toggleSpecialty,
  toggleTechnology,
} from './research-draft.ts';
import { strategyCommand } from './spec-pools.ts';
import type { Progress, ResearchPlan, SpecContext, TableAction, TableSpec } from './spec-types.ts';
import type { TargetState } from './target-ref.ts';
import type { TableDecision } from './use-table-decision.ts';

/*
 * Technologie (RR 81) am Tisch, primär und sekundär: Karten der Forschungsauslage wählen,
 * Spezialisierungen als Ersatz fehlender Farben nutzen, bezahlen. Anzahl und Kosten nennt die
 * Domain (`researchCost`), ob die Wahl gilt, erprobt sie (`researchEvents`).
 */

export type ResearchSpec = TableSpec<ResearchPlan, TableAction>;

const abilityOf = (ctx: SpecContext): 'primary' | 'secondary' =>
  ctx.route.ability === 'secondary' ? 'secondary' : 'primary';

function costFor(ctx: SpecContext, count: number): Result<number, DomainError> {
  const card = content.strategyCards.find((entry) => entry.id === ctx.route.card);
  if (card === undefined) return err(domainError('technology.unknownCard', 'Keine Strategiekarte'));
  return researchCost(card, abilityOf(ctx), count);
}

/** Kosten der gewählten Anzahl; eine ungültige Anzahl kostet (noch) nichts. */
const requiredOf = (ctx: SpecContext, plan: ResearchPlan): number => {
  const cost = costFor(ctx, plan.technologies.length);
  return cost.ok ? cost.value : 0;
};

const canAddMore = (ctx: SpecContext, plan: ResearchPlan): boolean =>
  costFor(ctx, plan.technologies.length + 1).ok;

/** Höchstzahl der Technologien laut Karte und Fähigkeit. */
const maxOf = (ctx: SpecContext): number =>
  [1, 2, 3].filter((count) => costFor(ctx, count).ok).at(-1) ?? 0;

const optionsOf = (ctx: SpecContext, plan: ResearchPlan): readonly ResearchOption[] =>
  researchOptions(ctx.game, ctx.actor, content, researchRequest(plan));

const unlocked = (ctx: SpecContext, plan: ResearchPlan, technology: TechnologyId): boolean =>
  optionsOf(ctx, plan).some(
    (option) => option.technology.id === technology && option.missing.length === 0,
  );

const specialtiesOf = (ctx: SpecContext): readonly SpecialtyPlanet[] =>
  specialtyPlanets(ctx.game, ctx.actor, content);

/** Bezahlbare Planeten ohne die als Spezialisierung genutzten. */
const offeredOf = (ctx: SpecContext, plan: ResearchPlan): readonly PlanetId[] =>
  spendableIds(ctx.game, ctx.actor, 'resources').filter((id) => !plan.specialties.includes(id));

function paying(ctx: SpecContext, plan: ResearchPlan, action: TableAction): ResearchPlan {
  const { payment } = plan;
  if (requiredOf(ctx, plan) === 0) return plan;
  if (action.kind === 'planet')
    return { ...plan, payment: togglePlanet(payment, action.planet, offeredOf(ctx, plan)) };
  if (action.kind !== 'tradeGoods') return plan;
  return { ...plan, payment: addCoins(payment, action.delta, ownTradeGoods(ctx.game, ctx.actor)) };
}

function apply(ctx: SpecContext, plan: ResearchPlan, action: TableAction): ResearchPlan {
  if (action.kind === 'technology') {
    const selectable = canAddMore(ctx, plan) && unlocked(ctx, plan, action.technology);
    return toggleTechnology(plan, action.technology, selectable);
  }
  if (action.kind === 'specialty') {
    const usable = specialtiesOf(ctx).map((entry) => entry.planet);
    return toggleSpecialty(plan, action.planet, usable);
  }
  return paying(ctx, plan, action);
}

/** Die Bezahlung in der Planetenreihe, solange die Forschung etwas kostet. */
function planets(ctx: SpecContext, plan: ResearchPlan): PlanetSide | null {
  const required = requiredOf(ctx, plan);
  if (required === 0) return null;
  return {
    mode: 'pay',
    currency: 'resources',
    chosen: plan.payment.planets,
    offered: offeredOf(ctx, plan),
    limit: null,
    tradeGoods: plan.payment.tradeGoods,
    required,
  };
}

const targets = (ctx: SpecContext, plan: ResearchPlan): ReadonlyMap<string, TargetState> => {
  const side = planets(ctx, plan);
  return side === null ? new Map() : planetStates(side);
};

/** Anzahl erlaubt, genug bezahlt, und die Domain nimmt die Wahl samt Spezialisierungen an. */
function ready(ctx: SpecContext, plan: ResearchPlan): boolean {
  if (!costFor(ctx, plan.technologies.length).ok) return false;
  const paid = paymentValueOf(ctx.game, ctx.actor, plan.payment);
  if (paid < requiredOf(ctx, plan)) return false;
  return researchEvents(ctx.game, ctx.actor, researchRequest(plan), content).ok;
}

const progress = (ctx: SpecContext, plan: ResearchPlan): Progress => ({
  done: plan.technologies.length,
  needed: maxOf(ctx),
  ready: ready(ctx, plan),
});

export const TECHNOLOGY_SPEC: ResearchSpec = {
  id: 'technology',
  hint: () => 'tableHintResearch',
  confirm: () => 'research',
  initial: researchPlan,
  apply,
  targets,
  progress,
  command: (ctx, plan) =>
    strategyCommand(ctx, {
      mechanic: 'technology',
      technologies: plan.technologies,
      specialties: plan.specialties,
      payment: requiredOf(ctx, plan) === 0 ? NO_PAYMENT : paymentOf(plan.payment),
    }),
  planets,
};

/** Wie eine Karte der Auslage dasteht. */
export type ResearchCardState = 'chosen' | 'open' | 'locked' | 'full';

export interface ResearchCard {
  readonly technology: ResearchOption['technology'];
  readonly missing: readonly TechnologyColor[];
  readonly state: ResearchCardState;
}

/** Eine Spalte der Auslage je Farbe; `null` sind die Aufwertungen für Einheiten. */
export interface ResearchColumn {
  readonly color: TechnologyColor | null;
  readonly cards: readonly ResearchCard[];
}

export interface SpreadSpecialty extends SpecialtyPlanet {
  readonly chosen: boolean;
}

export interface ResearchSpread {
  readonly columns: readonly ResearchColumn[];
  readonly specialties: readonly SpreadSpecialty[];
  readonly count: number;
  readonly max: number;
  readonly required: number;
  /** Eine gewählte Spezialisierung wird nicht gebraucht; die Domain lehnte so ab. */
  readonly unusedSpecialty: boolean;
  /** Gewählte Karten ohne erfüllte Voraussetzungen; solange es sie gibt, bleibt das Siegel zu. */
  readonly unmet: readonly ResearchCard[];
}

export const RESEARCH_COLUMNS: readonly (TechnologyColor | null)[] = [
  'biotic',
  'propulsion',
  'cybernetic',
  'warfare',
  null,
];

function stateOf(option: ResearchOption, plan: ResearchPlan, room: boolean): ResearchCardState {
  if (plan.technologies.includes(option.technology.id)) return 'chosen';
  if (option.missing.length > 0) return 'locked';
  return room ? 'open' : 'full';
}

const cardOf = (option: ResearchOption, plan: ResearchPlan, room: boolean): ResearchCard => ({
  technology: option.technology,
  missing: option.missing,
  state: stateOf(option, plan, room),
});

/** Gesperrte Karten liegen am Ende ihrer Spalte; sonst bleibt die Reihenfolge des Inhalts. */
const lockedLast = (cards: readonly ResearchCard[]): readonly ResearchCard[] =>
  [...cards].sort((a, b) => Number(a.state === 'locked') - Number(b.state === 'locked'));

function cardsOf(ctx: SpecContext, plan: ResearchPlan): readonly ResearchCard[] {
  const room = canAddMore(ctx, plan);
  return optionsOf(ctx, plan).map((option) => cardOf(option, plan, room));
}

function columnsOf(cards: readonly ResearchCard[]): readonly ResearchColumn[] {
  return RESEARCH_COLUMNS.map((color) => ({
    color,
    cards: lockedLast(cards.filter((card) => card.technology.color === color)),
  }));
}

/** Gewählte Karten, denen eine Voraussetzung fehlt (etwa nach dem Zurücklegen einer anderen). */
const unmetOf = (cards: readonly ResearchCard[]): readonly ResearchCard[] =>
  cards.filter((card) => card.state === 'chosen' && card.missing.length > 0);

const unusedOf = (ctx: SpecContext, plan: ResearchPlan): boolean => {
  const probe = researchEvents(ctx.game, ctx.actor, researchRequest(plan), content);
  return !probe.ok && probe.error.code === 'technology.unusedSpecialty';
};

function spreadOf(ctx: SpecContext, plan: ResearchPlan): ResearchSpread {
  const specialties = specialtiesOf(ctx).map((entry) => ({
    ...entry,
    chosen: plan.specialties.includes(entry.planet),
  }));
  const cards = cardsOf(ctx, plan);
  return {
    columns: columnsOf(cards),
    unmet: unmetOf(cards),
    specialties,
    count: plan.technologies.length,
    max: maxOf(ctx),
    required: requiredOf(ctx, plan),
    unusedSpecialty: unusedOf(ctx, plan),
  };
}

/** Die Forschungsauslage der offenen Tischentscheidung; `null`, wenn gerade nicht geforscht wird. */
export function researchSpreadOf(
  game: GameState,
  decision: TableDecision | null,
): ResearchSpread | null {
  const draft = decision?.draft;
  const actor = decision?.route.actor ?? null;
  if (decision == null || draft?.kind !== 'research' || actor === null) return null;
  return spreadOf({ game, actor, route: decision.route }, draft);
}
