import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import { andThen, err, map, ok, type Result } from '../shared/result.ts';
import { tacticalStepCheck } from '../tactical/tactical-commands.ts';
import { reachNext } from '../tactical/tactical-steps.ts';
import { type ProductionRequest, productionEvents } from './production.ts';

/** RR 79.5 Schritt „Produktion“: leere Bestellung heißt „nichts produzieren“. */
export interface ProduceUnits extends Command<'ProduceUnits'>, ProductionRequest {}

type Events = Result<readonly GameEvent[], DomainError>;

export const produceUnitsHandler = {
  commandType: 'ProduceUnits',
  decide(state: GameState, command: ProduceUnits, decision: DecisionContext): Events {
    const system = state.actionPhase?.tactical?.system;
    if (system === undefined) return err(domainError('tactical.notActive', 'Keine Taktikaktion'));
    const player = command.issuedBy;
    const produced =
      command.orders.length === 0
        ? ok([])
        : productionEvents({ state, system, player, request: command, decision });
    return andThen(tacticalStepCheck(state, command, 'production'), () =>
      map(produced, (events) => {
        const after = events.reduce(evolveGame, state);
        return [...events, reachNext(after, 'production', decision.content)];
      }),
    );
  },
} as const satisfies CommandHandler<GameState, ProduceUnits, GameEvent>;
