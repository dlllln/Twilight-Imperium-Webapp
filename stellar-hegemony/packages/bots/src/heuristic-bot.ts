import {
  type DecisionContext,
  decideGameCommand,
  type GameCommand,
  type GameState,
  type PlayerId,
} from '@stellar/domain';
import { actionPhase } from './action-planner.ts';
import { agendaPhase } from './agenda-planner.ts';
import { botView, type Planner } from './bot-view.ts';
import { discardExcess, keepSecrets, passReaction } from './interruptions.ts';
import { statusPhase } from './status-planner.ts';
import { pickStrategyCard } from './strategy-pick.ts';

/** Strategy Pattern: Bots unterscheiden sich nur darin, welche Commands sie vorschlagen. */
export interface BotStrategy {
  readonly id: string;
  /** Nächster gültiger Command des Spielers oder `null`, wenn er nichts tun kann. */
  nextCommand(state: GameState, player: PlayerId, context: DecisionContext): GameCommand | null;
}

/** Reihenfolge wie `currentActor`: Unterbrechungen zuerst, dann die laufende Phase. */
const PLANNERS: readonly Planner[] = [
  keepSecrets,
  passReaction,
  discardExcess,
  pickStrategyCard,
  statusPhase,
  agendaPhase,
  actionPhase,
];

/**
 * Generate and Test: Planer schlagen Commands vor, die Domain prüft sie. So kann ein Bot
 * nie gegen Regeln verstoßen, und ein schwacher Vorschlag fällt auf den nächsten zurück.
 */
export const heuristicBot: BotStrategy = {
  id: 'heuristic',
  nextCommand(state, player, context) {
    const view = botView(state, player, context);
    for (const planner of PLANNERS) {
      const accepted = planner(view).find(
        (command) => decideGameCommand(state, command, context).ok,
      );
      if (accepted !== undefined) return accepted;
    }
    return null;
  },
};
