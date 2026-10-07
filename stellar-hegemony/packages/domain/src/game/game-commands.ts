import type { CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import { err, type Result } from '../shared/result.ts';
import {
  generateGalaxyHandler,
  type GenerateGalaxy,
  importMapHandler,
  type ImportMap,
} from '../galaxy/galaxy-commands.ts';
import { seatPlayerHandler, type SeatPlayer } from '../setup/setup-commands.ts';
import type { GameEvent } from './game-events.ts';
import type { GameState } from './game-state.ts';

/** Alle Commands einer laufenden Partie (CreateGame ist der Sonderfall davor). */
export type GameCommand = SeatPlayer | ImportMap | GenerateGalaxy;

type HandlerMap = {
  readonly [K in GameCommand['type']]: CommandHandler<
    GameState,
    Extract<GameCommand, { type: K }>,
    GameEvent
  >;
};

const handlers: HandlerMap = {
  SeatPlayer: seatPlayerHandler,
  ImportMap: importMapHandler,
  GenerateGalaxy: generateGalaxyHandler,
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
  // TypeScript kann command.type und den Handler-Typ nicht korrelieren.
  const handler = handlers[command.type] as CommandHandler<GameState, GameCommand, GameEvent>;
  return handler.decide(state, command, context);
}
