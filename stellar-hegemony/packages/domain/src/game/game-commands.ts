import type { CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import { err, type Result } from '../shared/result.ts';
import { seatPlayerHandler, type SeatPlayer } from '../setup/setup-commands.ts';
import type { GameEvent } from './game-events.ts';
import type { GameState } from './game-state.ts';

/** Alle Commands einer laufenden Partie (CreateGame ist der Sonderfall davor). */
export type GameCommand = SeatPlayer;

type HandlerMap = {
  readonly [K in GameCommand['type']]: CommandHandler<
    GameState,
    Extract<GameCommand, { type: K }>,
    GameEvent
  >;
};

const handlers: HandlerMap = {
  SeatPlayer: seatPlayerHandler,
};

/** Controller-Einstieg der Domain: wählt den passenden Handler (Command Pattern). */
export function decideGameCommand(
  state: GameState,
  command: GameCommand,
  context: DecisionContext,
): Result<readonly GameEvent[], DomainError> {
  if (state.winner !== null) {
    return err(domainError('game.over', 'Die Partie ist beendet'));
  }
  return handlers[command.type].decide(state, command, context);
}
