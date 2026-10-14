import type { CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { type Check, type DomainError, firstFailure, guard } from '../shared/domain-error.ts';
import { map, type Result } from '../shared/result.ts';
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
import { boardLimitEvents } from '../galaxy/board-limits.ts';
import {
  type AllocateCommandTokens,
  allocateCommandTokensHandler,
  type EndScoring,
  endScoringHandler,
} from '../status/status-commands.ts';
import {
  type DiscardActionCards,
  discardActionCardsHandler,
  type PassReaction,
  passReactionHandler,
  type PlayActionCard,
  playActionCardHandler,
} from '../action-card/action-card-commands.ts';
import {
  type Abstain,
  abstainHandler,
  type BreakTie,
  breakTieHandler,
  type CastVotes,
  castVotesHandler,
} from '../agenda/agenda-commands.ts';
import {
  type ExploreFrontier,
  exploreFrontierHandler,
  type PurgeRelicFragments,
  purgeRelicFragmentsHandler,
  type UseLegendaryAbility,
  useLegendaryAbilityHandler,
  type UseRelic,
  useRelicHandler,
} from '../exploration/exploration-commands.ts';
import { progressTactical } from '../combat/tactical-flow.ts';
import { phaseOf } from '../phases/game-phase.ts';
import { withTechnologies } from '../technology/technology-catalog.ts';
import { type StartGame, startGameHandler } from '../phases/start-game.ts';
import { seatPlayerHandler, type SeatPlayer } from '../setup/setup-commands.ts';
import { type PickStrategyCard, pickStrategyCardHandler } from '../strategy/pick-strategy-card.ts';
import { evolveGame, type GameEvent } from './game-events.ts';
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
  | AllocateCommandTokens
  | PlayActionCard
  | PassReaction
  | DiscardActionCards
  | CastVotes
  | Abstain
  | BreakTie
  | ExploreFrontier
  | PurgeRelicFragments
  | UseRelic
  | UseLegendaryAbility;

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
  PlayActionCard: playActionCardHandler,
  PassReaction: passReactionHandler,
  DiscardActionCards: discardActionCardsHandler,
  CastVotes: castVotesHandler,
  Abstain: abstainHandler,
  BreakTie: breakTieHandler,
  ExploreFrontier: exploreFrontierHandler,
  PurgeRelicFragments: purgeRelicFragmentsHandler,
  UseRelic: useRelicHandler,
  UseLegendaryAbility: useLegendaryAbilityHandler,
};

/** Während ein Zeitfenster offen ist, sind nur Reaktionen erlaubt (RR 3.10). */
const REACTIONS: readonly string[] = ['PlayActionCard', 'PassReaction', 'DiscardActionCards'];

const reactionOpen = (state: GameState) =>
  state.reactionWindow !== null || state.pendingPlay !== null;

/** Nach jedem Command läuft die Taktikaktion weiter, bis wieder jemand entscheiden muss. */
function withFlow(
  state: GameState,
  events: readonly GameEvent[],
  context: DecisionContext,
): readonly GameEvent[] {
  const after = events.reduce(evolveGame, state);
  const progressed = [...events, ...progressTactical(after, context)];
  const settled = progressed.slice(events.length).reduce(evolveGame, after);
  return [...progressed, ...boardLimitEvents(settled, context.content)];
}

/** Ob der Command überhaupt an der Reihe ist: Partie läuft, Phase passt, kein Zeitfenster offen. */
function admission(state: GameState, command: GameCommand): Check {
  return firstFailure([
    guard(state.winner === null, 'game.over', 'Die Partie ist beendet'),
    guard(
      phaseOf(state).accepts(command.type),
      'phase.commandNotAllowed',
      `${command.type} ist in dieser Phase nicht erlaubt`,
      { phase: state.phase },
    ),
    guard(
      !reactionOpen(state) || REACTIONS.includes(command.type),
      'reaction.open',
      'Erst das offene Zeitfenster abschließen',
    ),
  ]);
}

/** Controller-Einstieg der Domain: wählt den passenden Handler (Command Pattern). */
export function decideGameCommand(
  state: GameState,
  command: GameCommand,
  context: DecisionContext,
): Result<readonly GameEvent[], DomainError> {
  const admitted = admission(state, command);
  if (!admitted.ok) return admitted;
  // TypeScript kann command.type und den Handler-Typ nicht korrelieren.
  const handler = handlers[command.type] as CommandHandler<GameState, GameCommand, GameEvent>;
  // Alle Einheitenwerte kommen mit den Technologien der Spieler (RR 80.6, Aufwertungen).
  const decision = withTechnologies(context, state);
  const decided = handler.decide(state, command, decision);
  // RR 68.7: Wer das Siegpunktziel erreicht, beendet die Partie sofort.
  return map(decided, (events) => withVictory(state, withFlow(state, events, decision)));
}
