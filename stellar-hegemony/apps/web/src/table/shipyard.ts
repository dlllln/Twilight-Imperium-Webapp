import {
  type GameState,
  isBlockaded,
  type PlanetId,
  type PlayerId,
  type ProductionChoice,
  type ProductionQuote,
  productionChoices,
  productionQuote,
  type SystemId,
} from '@stellar/domain';
import { content } from '../store.ts';
import { groundOf, needsGround, ordersOf } from './production-draft.ts';
import type { ProductionPlan } from './spec-types.ts';
import type { TableDecision } from './use-table-decision.ts';

/*
 * Die Werft als Ansicht über dem Entwurf: was sich bauen lässt, was die Bestellung kostet und
 * wohin neue Bodentruppen gehen. Alle Zahlen kommen aus der Domain.
 */

export interface Shipyard {
  readonly system: SystemId;
  readonly choices: readonly ProductionChoice[];
  readonly quote: ProductionQuote;
  /** Planet neuer Bodentruppen: der gewählte oder der erste mögliche; `null`, wenn keiner. */
  readonly groundPlanet: PlanetId | null;
  /** Bestellte Bodentruppen brauchen einen Planeten. */
  readonly needsGround: boolean;
  /** Fremde Schiffe ohne eigene im System: Schiffe lassen sich nicht bauen (RR 14). */
  readonly blockaded: boolean;
}

interface Cached {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly plan: ProductionPlan;
  readonly yard: Shipyard | null;
}

/** Ein Eintrag genügt: Ansage, Pult und Karte fragen je Bild dieselbe Werft mehrfach. */
let last: Cached | null = null;

function computed(game: GameState, player: PlayerId, plan: ProductionPlan): Shipyard | null {
  const { system } = plan;
  if (system === null) return null;
  const orders = ordersOf(plan);
  const quote = productionQuote(game, system, player, orders, content);
  const choices = productionChoices(game, system, player, orders, content);
  return {
    system,
    choices,
    quote,
    groundPlanet: groundOf(plan, quote.groundPlanets),
    needsGround: needsGround(plan, choices),
    blockaded: isBlockaded(game, system, player, content.units),
  };
}

/** Die Werft zu Spielstand, Spieler und Entwurf; ohne System keine. */
export function shipyardFor(
  game: GameState,
  player: PlayerId,
  plan: ProductionPlan,
): Shipyard | null {
  if (last?.game === game && last.player === player && last.plan === plan) return last.yard;
  const yard = computed(game, player, plan);
  last = { game, player, plan, yard };
  return yard;
}

/** Die Werft der offenen Tischentscheidung; `null`, wenn gerade nicht gebaut wird. */
export function shipyardOf(game: GameState, decision: TableDecision | null): Shipyard | null {
  const draft = decision?.draft;
  const actor = decision?.route.actor ?? null;
  if (draft?.kind !== 'production' || actor === null) return null;
  return shipyardFor(game, actor, draft);
}

/** Ob die Bestellung laut Domain gilt: Platz, keine Blockade für Schiffe, Vorrat. */
export const quoteValid = (yard: Shipyard): boolean =>
  yard.quote.count <= yard.quote.limit &&
  !yard.quote.blockaded &&
  yard.choices.every((choice) => choice.supply === null || choice.supply >= 0);

/** Kosten je Einheit; ohne Kosten ganz hinten. */
const perUnit = (choice: ProductionChoice): number => {
  const cost = choice.unit.cost;
  return cost === undefined ? Number.POSITIVE_INFINITY : cost.resources / cost.unitsPerCost;
};

/**
 * Die Steine der Werft, die günstigsten vorn (Jäger und Infanterie zuerst): Sie werden am
 * häufigsten gebaut und sollen ohne Rollen in der Reihe liegen. Gleich teure behalten ihre Folge.
 */
export const cheapFirst = (choices: readonly ProductionChoice[]): readonly ProductionChoice[] =>
  [...choices].sort((a, b) => perUnit(a) - perUnit(b));
