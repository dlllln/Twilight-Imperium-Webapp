import type { CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import { err, map, type Result } from '../shared/result.ts';
import {
  generateGalaxyHandler,
  type GenerateGalaxy,
  importMapHandler,
  type ImportMap,
} from '../galaxy/galaxy-commands.ts';
import {
  type DeclineSecondary,
  declineSecondaryHandler,
  type Pass,
  passHandler,
  type PerformStrategicAction,
  performStrategicActionHandler,
  type ResolveSecondary,
  resolveSecondaryHandler,
} from '../action/action-commands.ts';
import {
  type ActivateSystem,
  activateSystemHandler,
  type EndTacticalAction,
  endTacticalActionHandler,
  type MoveShips,
  moveShipsHandler,
} from '../tactical/tactical-commands.ts';
import {
  type AssignHits,
  assignHitsHandler,
  type DeclareRetreat,
  declareRetreatHandler,
} from '../combat/combat-commands.ts';
import {
  type Bombard,
  bombardHandler,
  type CommitGroundForces,
  commitGroundForcesHandler,
} from '../invasion/invasion-commands.ts';
import { type ProduceUnits, produceUnitsHandler } from '../production/production-commands.ts';
import {
  type AcceptTransaction,
  acceptTransactionHandler,
  type ProposeTransaction,
  proposeTransactionHandler,
  type RejectTransaction,
  rejectTransactionHandler,
} from '../transaction/transaction-commands.ts';
import {
  type KeepSecretObjectives,
  keepSecretObjectivesHandler,
  type ScoreObjective,
  scoreObjectiveHandler,
} from '../objective/objective-commands.ts';
import { withVictory } from '../objective/victory.ts';
import {
  type AllocateCommandTokens,
  allocateCommandTokensHandler,
  type EndScoring,
  endScoringHandler,
} from '../status/status-commands.ts';
import { phaseOf } from '../phases/game-phase.ts';
import { withTechnologies } from '../technology/technology-catalog.ts';
import { type StartGame, startGameHandler } from '../phases/start-game.ts';
import { seatPlayerHandler, type SeatPlayer } from '../setup/setup-commands.ts';
import { type PickStrategyCard, pickStrategyCardHandler } from '../strategy/pick-strategy-card.ts';
import type { GameEvent } from './game-events.ts';
import type { GameState } from './game-state.ts';

/** Alle Commands einer laufenden Partie (CreateGame ist der Sonderfall davor). */
export type GameCommand =
  | SeatPlayer
  | ImportMap
  | GenerateGalaxy
  | StartGame
  | PickStrategyCard
  | PerformStrategicAction
  | ResolveSecondary
  | DeclineSecondary
  | Pass
  | ActivateSystem
  | MoveShips
  | EndTacticalAction
  | AssignHits
  | DeclareRetreat
  | Bombard
  | CommitGroundForces
  | ProduceUnits
  | ProposeTransaction
  | AcceptTransaction
  | RejectTransaction
  | KeepSecretObjectives
  | ScoreObjective
  | EndScoring
  | AllocateCommandTokens;

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
  StartGame: startGameHandler,
  PickStrategyCard: pickStrategyCardHandler,
  PerformStrategicAction: performStrategicActionHandler,
  ResolveSecondary: resolveSecondaryHandler,
  DeclineSecondary: declineSecondaryHandler,
  Pass: passHandler,
  ActivateSystem: activateSystemHandler,
  MoveShips: moveShipsHandler,
  EndTacticalAction: endTacticalActionHandler,
  AssignHits: assignHitsHandler,
  DeclareRetreat: declareRetreatHandler,
  Bombard: bombardHandler,
  CommitGroundForces: commitGroundForcesHandler,
  ProduceUnits: produceUnitsHandler,
  ProposeTransaction: proposeTransactionHandler,
  AcceptTransaction: acceptTransactionHandler,
  RejectTransaction: rejectTransactionHandler,
  KeepSecretObjectives: keepSecretObjectivesHandler,
  ScoreObjective: scoreObjectiveHandler,
  EndScoring: endScoringHandler,
  AllocateCommandTokens: allocateCommandTokensHandler,
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
  if (!phaseOf(state).accepts(command.type)) {
    return err(
      domainError('phase.commandNotAllowed', `${command.type} ist in dieser Phase nicht erlaubt`, {
        phase: state.phase,
      }),
    );
  }
  // TypeScript kann command.type und den Handler-Typ nicht korrelieren.
  const handler = handlers[command.type] as CommandHandler<GameState, GameCommand, GameEvent>;
  // Alle Einheitenwerte kommen mit den Technologien der Spieler (RR 80.6, Aufwertungen).
  const decided = handler.decide(state, command, withTechnologies(context, state));
  // RR 68.7: Wer das Siegpunktziel erreicht, beendet die Partie sofort.
  return map(decided, (events) => withVictory(state, events));
}
