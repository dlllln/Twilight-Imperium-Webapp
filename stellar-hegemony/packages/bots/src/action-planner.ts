import {
  freeSecondary,
  type GameCommand,
  NO_TARGET,
  type StrategyCardDefinition,
  strategyCardsOf,
  usableCards,
} from '@stellar/domain';
import { type BotView, contentOf, issued, me, type Planner } from './bot-view.ts';
import { assignHits, declineRetreat } from './combat-planner.ts';
import { bombardCommands, invasionCommands } from './invasion-planner.ts';
import { planMoves } from './move-planner.ts';
import { productionCommands } from './production-planner.ts';
import { primaryChoices, secondaryChoices } from './strategy-choices.ts';
import { tacticalTargets } from './target-planner.ts';

const definitionOf = (view: BotView, id: string): StrategyCardDefinition | undefined =>
  contentOf(view).strategyCards.find((card) => card.id === id);

/** RR 46.5: einen Strategiemarker behalten, außer die Sekundärfähigkeit ist gratis. */
const RESERVED_STRATEGY_TOKENS = 1;

/** Ob die Sekundärfähigkeit den Bot nichts kostet (RR 34.4, Fraktionsfähigkeit). */
function isFree(view: BotView, card: StrategyCardDefinition, free: readonly string[]): boolean {
  return (
    free.includes(view.player) ||
    !card.secondaryCostsStrategyToken ||
    freeSecondary(view.state, view.player, card.mechanic)
  );
}

function secondary(view: BotView): readonly GameCommand[] {
  const window = view.state.actionPhase?.secondary ?? null;
  if (window?.awaiting[0] !== view.player) return [];
  const card = definitionOf(view, window.card);
  if (card === undefined) return [{ type: 'DeclineSecondary', ...issued(view) }];
  const affordable =
    isFree(view, card, window.free) || me(view).commandPools.strategy > RESERVED_STRATEGY_TOKENS;
  const choices = affordable ? secondaryChoices(view, card) : [];
  return [
    ...choices.map((choice) => ({ type: 'ResolveSecondary' as const, ...issued(view), choice })),
    { type: 'DeclineSecondary', ...issued(view) },
  ];
}

/** Bots tauschen nicht: Angebote lehnen sie ab. */
const transaction: Planner = (view) =>
  view.state.actionPhase?.transaction?.to === view.player
    ? [{ type: 'RejectTransaction', ...issued(view) }]
    : [];

const STEP_PLANNERS: Readonly<Record<string, Planner>> = {
  movement: (view) => {
    const system = view.state.actionPhase?.tactical?.system;
    const moves = system === undefined ? [] : planMoves(view, system);
    return [
      { type: 'MoveShips', ...issued(view), moves },
      { type: 'MoveShips', ...issued(view), moves: [] },
    ];
  },
  bombardment: bombardCommands,
  invasion: invasionCommands,
  production: productionCommands,
  done: (view) => [{ type: 'EndTacticalAction', ...issued(view) }],
};

const tacticalStep: Planner = (view) => {
  const step = view.state.actionPhase?.tactical?.step;
  return step === undefined ? [] : (STEP_PLANNERS[step]?.(view) ?? []);
};

/** RR 75: unbenutzte eigene Strategiekarten mit ihren besten Auswahlen. */
function strategicActions(view: BotView): readonly GameCommand[] {
  return strategyCardsOf(view.state, view.player)
    .filter((card) => !card.exhausted)
    .flatMap((card) => {
      const definition = definitionOf(view, card.id);
      const choices = definition === undefined ? [] : primaryChoices(view, definition);
      return choices.map((choice) => ({
        type: 'PerformStrategicAction' as const,
        ...issued(view),
        card: card.id,
        choice,
      }));
    });
}

/** Aktionskarten ohne Ziel, die gerade wirken würden (Komponentenaktion, RR 3). */
const actionCards = (view: BotView): readonly GameCommand[] =>
  usableCards(view.state, view.player, 'action', contentOf(view)).map((card) => ({
    type: 'PlayActionCard',
    ...issued(view),
    card: card.id,
    target: NO_TARGET,
  }));

/** Eigener Zug: Taktik zuerst, wenn es lohnende Ziele gibt, sonst Strategie, Karten, Passen. */
function mainTurn(view: BotView): readonly GameCommand[] {
  return [
    ...tacticalTargets(view),
    ...strategicActions(view),
    ...actionCards(view),
    { type: 'Pass', ...issued(view) },
  ];
}

/** Aktionsphase: wer gerade gefragt ist, bekommt die passenden Vorschläge. */
export const actionPhase: Planner = (view) => {
  const turn = view.state.actionPhase;
  if (view.state.phase !== 'action' || turn === null) return [];
  const asked = [secondary, transaction, assignHits, declineRetreat].flatMap((p) => p(view));
  if (asked.length > 0) return asked;
  if (turn.active !== view.player) return [];
  return turn.tactical === null ? mainTurn(view) : tacticalStep(view);
};
