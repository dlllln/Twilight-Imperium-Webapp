import type { GameEvent } from '../game/game-events.ts';
import { controlsCenter } from '../objective/board-queries.ts';
import { findObjective, drawSecretEvents, scoringEvents } from '../objective/objective-scoring.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import { andThen, err, map, ok, type Result } from '../shared/result.ts';
import {
  choiceOf,
  type EffectInput,
  type ImperialChoice,
  parameterOf,
  type StrategyEffect,
} from './strategy-effect.ts';

type Events = Result<readonly GameEvent[], DomainError>;

/** RR 37.2: ein öffentlicher Auftrag nach Wahl, sofern erfüllt; ohne Wahl entfällt das Werten. */
function scoring(input: EffectInput, choice: ImperialChoice): Events {
  const { state, player, context } = input;
  const objective = choice.objective;
  if (objective === null) return ok([]);
  return andThen(findObjective(context.content, objective), (definition) =>
    definition.category === 'public'
      ? scoringEvents(state, player, { objective, payment: choice.payment }, context.content)
      : err(domainError('objective.notPublic', 'Nur öffentliche Aufträge')),
  );
}

/** Danach 1 Siegpunkt mit der Thronwelt, sonst ein geheimer Auftrag. */
function throneOrSecret(input: EffectInput): Events {
  const { state, player, context, card } = input;
  if (!controlsCenter(state, player, context.content)) return ok(drawSecretEvents(state, player));
  return map(parameterOf(card, 'throneVictoryPoints'), (points) => [
    { type: 'VictoryPointsGained', player, points } as const,
  ]);
}

function primary(input: EffectInput): Events {
  return andThen(choiceOf(input, 'imperial'), (choice) =>
    andThen(scoring(input, choice), (scored) =>
      map(throneOrSecret(input), (rest) => [...scored, ...rest]),
    ),
  );
}

/** RR 37.3: für einen Strategiemarker einen geheimen Auftrag ziehen. */
const secondary = (input: EffectInput): Events => ok(drawSecretEvents(input.state, input.player));

export const imperialEffect: StrategyEffect = { mechanic: 'imperial', primary, secondary };
