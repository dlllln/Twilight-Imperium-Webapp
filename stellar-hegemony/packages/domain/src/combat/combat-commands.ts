import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import { type DomainError, domainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { SystemId, UnitId } from '../shared/ids.ts';
import { err, map, type Result } from '../shared/result.ts';
import { shipsOf } from './combat-queries.ts';
import { validateHitAssignment } from './hit-assignment.ts';
import { retreatTargets } from './space-combat.ts';
import { progressTactical } from './tactical-flow.ts';

export interface AssignHits extends Command<'AssignHits'> {
  readonly sustained: readonly UnitId[];
  readonly destroyed: readonly UnitId[];
}

export interface DeclareRetreat extends Command<'DeclareRetreat'> {
  /** Zielsystem des Rückzugs oder `null` für „weiterkämpfen“. */
  readonly to: SystemId | null;
}

type Events = Result<readonly GameEvent[], DomainError>;

/** Nach jeder Entscheidung läuft der Ablauf bis zur nächsten Entscheidung weiter. */
const withProgress = (
  state: GameState,
  events: readonly GameEvent[],
  decision: DecisionContext,
) => [...events, ...progressTactical(events.reduce(evolveGame, state), decision)];

/** RR 89.1, RR 66: Treffer auf die eigenen Schiffe im aktiven System verteilen. */
export const assignHitsHandler = {
  commandType: 'AssignHits',
  decide(state: GameState, command: AssignHits, decision: DecisionContext): Events {
    const tactical = state.actionPhase?.tactical;
    const pending = tactical?.pendingHits.find((entry) => entry.player === command.issuedBy);
    if (tactical == null || pending === undefined)
      return err(domainError('combat.noPendingHits', 'Keine Treffer zuzuweisen'));
    const catalog = decision.content.units;
    const ships = shipsOf(state, tactical.system, command.issuedBy, catalog);
    const validated = validateHitAssignment(ships, pending.hits, command, catalog);
    return map(validated, ({ sustained, destroyed }) => {
      const assigned: GameEvent = {
        type: 'HitsAssigned',
        player: command.issuedBy,
        system: tactical.system,
        sustained,
        destroyed,
      };
      return withProgress(state, [assigned], decision);
    });
  },
} as const satisfies CommandHandler<GameState, AssignHits, GameEvent>;

function retreatChecks(state: GameState, command: DeclareRetreat, decision: DecisionContext) {
  const tactical = state.actionPhase?.tactical;
  const system = tactical?.system;
  const targets =
    system === undefined
      ? []
      : retreatTargets(state, system, command.issuedBy, decision.content.units);
  return firstFailure([
    guard(
      tactical?.combat?.awaitingRetreat[0] === command.issuedBy,
      'combat.notYourDecision',
      'Du entscheidest gerade nicht über einen Rückzug',
    ),
    guard(
      command.to === null || targets.includes(command.to),
      'combat.invalidRetreat',
      'Dorthin ist kein Rückzug möglich',
    ),
  ]);
}

/** RR 63.5 Schritt 2: Verteidiger zuerst; ein Rückzugsziel muss erlaubt sein (RR 63.7). */
export const declareRetreatHandler = {
  commandType: 'DeclareRetreat',
  decide(state: GameState, command: DeclareRetreat, decision: DecisionContext): Events {
    const declared: GameEvent = {
      type: 'RetreatDeclared',
      player: command.issuedBy,
      to: command.to,
    };
    return map(retreatChecks(state, command, decision), () =>
      withProgress(state, [declared], decision),
    );
  },
} as const satisfies CommandHandler<GameState, DeclareRetreat, GameEvent>;
