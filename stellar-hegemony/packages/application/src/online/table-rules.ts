import {
  createGameHandler,
  type DecisionContext,
  decideGameCommand,
  type DomainError,
  evolveGame,
  type GameConfig,
  type GameState,
  type Result,
  andThen,
  map,
  replayGame,
  type RuleNumbers,
  validateGameConfig,
} from '@stellar/domain';
import { createGameCommand, setupCommands, type TableSpec } from '../game-setup.ts';

/** Regelwerte für neue Online-Partien; der Server liest sie aus dem Content. */
export interface TableRules {
  readonly rules: RuleNumbers;
  readonly victoryPointsToWin: number;
}

export const tableConfig = (
  table: TableRules,
  playerCount: number,
): Result<GameConfig, DomainError> =>
  validateGameConfig({
    playerCount,
    victoryPointsToWin: table.victoryPointsToWin,
    rules: table.rules,
  });

/** Probelauf des Aufbaus im Speicher: eine Lobby mit unbrauchbarer Galaxie entsteht gar nicht. */
export function rehearseSetup(
  table: TableSpec,
  context: DecisionContext,
): Result<GameState, DomainError> {
  const created = andThen(createGameHandler.decide(null, createGameCommand(table)), replayGame);
  return setupCommands(table, context.content.factions).reduce<Result<GameState, DomainError>>(
    (state, command) =>
      andThen(state, (current) =>
        map(decideGameCommand(current, command, context), (events) =>
          events.reduce(evolveGame, current),
        ),
      ),
    created,
  );
}
