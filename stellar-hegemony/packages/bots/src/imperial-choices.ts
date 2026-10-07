import { NO_PAYMENT, scoringOptions, type StrategyChoice } from '@stellar/domain';
import { type BotView, contentOf } from './bot-view.ts';
import { objectivePayment } from './status-planner.ts';

/** Imperium primär: einen erfüllten öffentlichen Auftrag werten, sonst nur den Punkt. */
export function scoringChoices(view: BotView): readonly StrategyChoice[] {
  const met = scoringOptions(view.state, view.player, contentOf(view))
    .filter((option) => option.met && option.definition.category === 'public')
    .map(({ definition }) => ({
      mechanic: 'imperial' as const,
      objective: definition.id,
      payment: objectivePayment(view, definition),
    }));
  return [...met, { mechanic: 'imperial', objective: null, payment: NO_PAYMENT }];
}
