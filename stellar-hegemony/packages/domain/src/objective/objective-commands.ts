import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import type { Payment } from '../economy/payment.ts';
import type { GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import { shuffle } from '../ports/random-port.ts';
import { type Check, type DomainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { ObjectiveId, PlayerId } from '../shared/ids.ts';
import { andThen, ok, type Result } from '../shared/result.ts';
import type { ObjectiveDefinition } from './objective-definition.ts';
import { findObjective, scoringEvents } from './objective-scoring.ts';

/** RR 12.20 / 37.4: aus der offenen Auswahl die behaltenen geheimen Aufträge nennen. */
export interface KeepSecretObjectives extends Command<'KeepSecretObjectives'> {
  readonly keep: readonly ObjectiveId[];
}

export interface ScoreObjective extends Command<'ScoreObjective'> {
  readonly objective: ObjectiveId;
  readonly payment: Payment;
}

type Events = Result<readonly GameEvent[], DomainError>;

function keepChecks(state: GameState, command: KeepSecretObjectives): Check {
  const choice = findPlayer(state, command.issuedBy)?.secretChoice ?? null;
  const keep = command.keep;
  return firstFailure([
    guard(choice !== null, 'objective.noChoice', 'Keine Auswahl offen'),
    guard(keep.length === choice?.keep, 'objective.keepCount', 'Falsche Anzahl'),
    guard(new Set(keep).size === keep.length, 'objective.keepCount', 'Doppelt gewählt'),
    guard(
      keep.every((id) => choice?.options.includes(id) === true),
      'objective.notOffered',
      'Nicht in der Auswahl',
    ),
  ]);
}

export const keepSecretObjectivesHandler = {
  commandType: 'KeepSecretObjectives',
  decide(state: GameState, command: KeepSecretObjectives, context: DecisionContext): Events {
    const checked = keepChecks(state, command);
    if (!checked.ok) return checked;
    const options = findPlayer(state, command.issuedBy)?.secretChoice?.options ?? [];
    const returned = options.filter((id) => !command.keep.includes(id));
    const secretDeck = shuffle(context.random, [...state.objectives.secretDeck, ...returned]);
    return ok([
      { type: 'SecretObjectivesKept', player: command.issuedBy, kept: command.keep, secretDeck },
    ]);
  },
} as const satisfies CommandHandler<GameState, KeepSecretObjectives, GameEvent>;

/** Im Schritt „Aufträge werten“: der Spieler ist dran und hat diese Art noch nicht gewertet. */
function statusTimingCheck(state: GameState, player: PlayerId, definition: ObjectiveDefinition) {
  const status = state.statusPhase;
  return firstFailure([
    guard(definition.timing === 'status', 'objective.wrongTiming', 'Nur in der Aktionsphase'),
    guard(
      status?.step === 'scoring' && status.waiting[0] === player,
      'status.notYourTurn',
      'Nicht an der Reihe',
    ),
    guard(
      status?.scored[player]?.includes(definition.category) !== true,
      'objective.limit',
      'Je Statusphase ein öffentlicher und ein geheimer Auftrag',
    ),
  ]);
}

/** RR 12.5–12.7: Statusaufträge im Schritt „Aufträge werten“, je Art einer; sonst Aktionsaufträge. */
export function timingCheck(
  state: GameState,
  player: PlayerId,
  definition: ObjectiveDefinition,
): Check {
  if (state.phase === 'action')
    return guard(definition.timing === 'action', 'objective.wrongTiming', 'Nur in der Statusphase');
  return statusTimingCheck(state, player, definition);
}

export const scoreObjectiveHandler = {
  commandType: 'ScoreObjective',
  decide(state: GameState, command: ScoreObjective, context: DecisionContext): Events {
    const player = command.issuedBy;
    return andThen(findObjective(context.content, command.objective), (definition) =>
      andThen(timingCheck(state, player, definition), () =>
        scoringEvents(state, player, command, context.content),
      ),
    );
  },
} as const satisfies CommandHandler<GameState, ScoreObjective, GameEvent>;
