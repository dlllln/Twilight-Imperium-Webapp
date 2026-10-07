import { evaluatePayment, type Payment, paymentEvents } from '../economy/payment.ts';
import type { GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { ObjectiveId, PlayerId } from '../shared/ids.ts';
import { andThen, err, map, ok, type Result } from '../shared/result.ts';
import { controlsHomeSystem } from './board-queries.ts';
import { meetsCondition } from './objective-conditions.ts';
import type { ObjectiveCondition, ObjectiveDefinition } from './objective-definition.ts';
import { scoredBy } from './objective-reducers.ts';

type Events = Result<readonly GameEvent[], DomainError>;

/** Was zum Werten gewählt ist; die Bezahlung gilt nur für Ausgabe-Aufträge. */
export interface ScoreRequest {
  readonly objective: ObjectiveId;
  readonly payment: Payment;
}

export function findObjective(
  content: ContentPort,
  id: ObjectiveId,
): Result<ObjectiveDefinition, DomainError> {
  const definition = content.objectives.find((objective) => objective.id === id);
  return definition === undefined
    ? err(domainError('objective.unknown', 'Unbekannter Auftrag', { objective: id }))
    : ok(definition);
}

const isRevealed = (state: GameState, id: ObjectiveId) =>
  state.objectives.public.some((slot) => slot.id === id && slot.revealed);

const holdsSecret = (state: GameState, player: PlayerId, id: ObjectiveId) =>
  findPlayer(state, player)?.secretObjectives.includes(id) === true;

const isAvailable = (state: GameState, player: PlayerId, definition: ObjectiveDefinition) =>
  definition.category === 'public'
    ? isRevealed(state, definition.id)
    : holdsSecret(state, player, definition.id);

/** RR 12.5/12.16/12.19: aufgedeckt bzw. eigener Geheimauftrag, noch nicht gewertet. */
export function availabilityChecks(
  state: GameState,
  player: PlayerId,
  definition: ObjectiveDefinition,
  content: ContentPort,
): Check {
  const homeKept = definition.category !== 'public' || controlsHomeSystem(state, player, content);
  const fresh = !scoredBy(state, definition.id).includes(player);
  return firstFailure([
    guard(isAvailable(state, player, definition), 'objective.notAvailable', 'Liegt nicht aus'),
    guard(fresh, 'objective.alreadyScored', 'Schon gewertet'),
    guard(homeKept, 'objective.homeLost', 'Heimatsystem nicht vollständig kontrolliert'),
  ]);
}

type Spend = Extract<ObjectiveCondition, { kind: 'spend' }>;

interface SpendInput {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly payment: Payment;
  readonly content: ContentPort;
}

/** RR 12.4: Ausgabe-Aufträge verlangen die Bezahlung beim Werten. */
function spendEvents({ state, player, payment, content }: SpendInput, spend: Spend): Events {
  const goodsOnly = spend.currency === 'tradeGoods';
  if (goodsOnly && payment.planets.length > 0)
    return err(domainError('objective.payment', 'Nur Handelswaren zählen'));
  const currency = goodsOnly ? 'resources' : spend.currency;
  const value = evaluatePayment(state, content.tiles, player, payment, currency);
  const short = domainError('objective.payment', 'Die Bezahlung reicht nicht');
  return andThen(value, (paid) =>
    paid >= spend.amount ? ok(paymentEvents(player, payment)) : err(short),
  );
}

function requirementEvents(
  state: GameState,
  player: PlayerId,
  definition: ObjectiveDefinition,
  request: ScoreRequest,
  content: ContentPort,
): Events {
  const { condition } = definition;
  if (condition.kind === 'spend')
    return spendEvents({ state, player, payment: request.payment, content }, condition);
  const met = meetsCondition({ state, player, content }, condition);
  return met ? ok([]) : err(domainError('objective.notMet', 'Anforderung nicht erfüllt'));
}

/**
 * Pure Fabrication für jedes Werten (Statusphase, Aktionsphase, Imperium):
 * Verfügbarkeit, Anforderung und gegebenenfalls Bezahlung, dann die Siegpunkte.
 */
export function scoringEvents(
  state: GameState,
  player: PlayerId,
  request: ScoreRequest,
  content: ContentPort,
): Events {
  return andThen(findObjective(content, request.objective), (definition) =>
    andThen(availabilityChecks(state, player, definition, content), () =>
      map(requirementEvents(state, player, definition, request, content), (paid) => [
        ...paid,
        {
          type: 'ObjectiveScored',
          player,
          objective: definition.id,
          points: definition.points,
        } as const,
      ]),
    ),
  );
}

/** RR 37.2/37.3: oberste Karte ziehen; über dem Maximum folgt eine Auswahl (RR 37.4). */
export function drawSecretEvents(state: GameState, player: PlayerId): readonly GameEvent[] {
  const [objective] = state.objectives.secretDeck;
  if (objective === undefined) return [];
  const held = findPlayer(state, player)?.secretObjectives.length ?? 0;
  const overLimit = held + 1 > state.config.rules.maxSecretObjectives;
  return [{ type: 'SecretObjectiveDrawn', player, objective, overLimit }];
}
