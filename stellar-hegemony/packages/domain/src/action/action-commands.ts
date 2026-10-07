import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { freeSecondary } from '../faction/faction-ability.ts';
import type { GameEvent } from '../game/game-events.ts';
import { clockwiseFrom, findPlayer, type GameState, strategyCardsOf } from '../game/game-state.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import { andThen, err, map, ok, type Result } from '../shared/result.ts';
import type { StrategyCardDefinition, StrategyCardId } from '../strategy/strategy-card.ts';
import type { StrategyChoice, StrategyEffect } from '../strategy/strategy-effect.ts';
import { strategyEffectFor } from '../strategy/strategy-effects.ts';
import { nextActivePlayer } from './turn-order.ts';

export interface PerformStrategicAction extends Command<'PerformStrategicAction'> {
  readonly card: StrategyCardId;
  readonly choice: StrategyChoice;
}

export interface ResolveSecondary extends Command<'ResolveSecondary'> {
  readonly choice: StrategyChoice;
}

export type DeclineSecondary = Command<'DeclineSecondary'>;
export type Pass = Command<'Pass'>;

type Events = Result<readonly GameEvent[], DomainError>;

function resolveEffect(
  card: StrategyCardDefinition | undefined,
): Result<{ card: StrategyCardDefinition; effect: StrategyEffect }, DomainError> {
  if (card === undefined)
    return err(domainError('strategy.unknownCard', 'Unbekannte Strategiekarte'));
  const effect = strategyEffectFor(card.mechanic);
  if (effect === undefined)
    return err(
      domainError('strategy.mechanicUnavailable', 'Diese Karte ist noch nicht spielbar', {
        mechanic: card.mechanic,
      }),
    );
  return ok({ card, effect });
}

const definitionOf = (context: DecisionContext, id: StrategyCardId | undefined) =>
  context.content.strategyCards.find((card) => card.id === id);

/** Eine neue Aktion beginnt nur, wenn keine andere mehr offen ist. */
export function activeTurnChecks(state: GameState, player: PlayerId): readonly Check[] {
  return [
    guard(state.actionPhase?.active === player, 'action.notYourTurn', 'Du bist nicht am Zug'),
    guard(
      state.actionPhase?.secondary === null,
      'action.secondaryOpen',
      'Erst alle Sekundärfähigkeiten abwarten',
    ),
    guard(
      state.actionPhase?.tactical === null,
      'action.tacticalOpen',
      'Erst die Taktikaktion abschließen',
    ),
  ];
}

/** Ende des Zugs: nächster aktiver Spieler oder Ende der Aktionsphase. */
export function endTurn(
  state: GameState,
  player: PlayerId,
  passed: readonly PlayerId[],
): readonly GameEvent[] {
  const turn = state.actionPhase;
  const next = turn === null ? null : nextActivePlayer(turn, player, passed);
  const ended: GameEvent = { type: 'TurnEnded', player, next };
  const order = turn?.order ?? [];
  return next === null
    ? [ended, { type: 'StatusPhaseStarted', round: state.round, order }]
    : [ended];
}

function strategicActionChecks(state: GameState, command: PerformStrategicAction): Check {
  const held = state.strategyCards[command.card];
  return firstFailure([
    ...activeTurnChecks(state, command.issuedBy),
    guard(held?.holder === command.issuedBy, 'strategy.notYourCard', 'Nicht deine Karte'),
    guard(held?.exhausted === false, 'strategy.cardUsed', 'Die Karte wurde bereits genutzt'),
  ]);
}

/** RR 74: Nach der Primärfähigkeit folgen reihum ab dem linken Nachbarn die anderen. */
const secondaryOrderFor = (state: GameState, player: PlayerId): readonly PlayerId[] =>
  clockwiseFrom(state, player)
    .slice(1)
    .map((p) => p.id);

function strategicActionEvents(
  state: GameState,
  command: PerformStrategicAction,
  context: DecisionContext,
): Events {
  const { issuedBy: player, choice, card: id } = command;
  const secondaryOrder = secondaryOrderFor(state, player);
  const performed: GameEvent = {
    type: 'StrategicActionPerformed',
    player,
    card: id,
    secondaryOrder,
  };
  return andThen(resolveEffect(definitionOf(context, id)), ({ card, effect }) =>
    map(effect.primary({ state, player, card, choice, context }), (events) => [
      performed,
      ...events,
    ]),
  );
}

export const performStrategicActionHandler = {
  commandType: 'PerformStrategicAction',
  decide(state: GameState, command: PerformStrategicAction, context: DecisionContext): Events {
    const checked = strategicActionChecks(state, command);
    return checked.ok ? strategicActionEvents(state, command, context) : checked;
  },
} as const satisfies CommandHandler<GameState, PerformStrategicAction, GameEvent>;

function secondaryChecks(state: GameState, player: PlayerId): Check {
  return guard(
    state.actionPhase?.secondary?.awaiting[0] === player,
    'action.notYourSecondary',
    'Du bist bei der Sekundärfähigkeit nicht an der Reihe',
  );
}

/** Nach der letzten Sekundär-Entscheidung endet der Zug des aktiven Spielers. */
function afterSecondary(state: GameState, player: PlayerId): readonly GameEvent[] {
  const turn = state.actionPhase;
  const remaining = turn?.secondary?.awaiting.filter((id) => id !== player) ?? [];
  if (turn?.active == null || remaining.length > 0) return [];
  return endTurn(state, turn.active, turn.passed);
}

/** RR 46.5: Die Sekundärfähigkeit kostet meist einen Marker aus dem Strategiepool. */
const paysStrategyToken = (state: GameState, player: PlayerId, card: StrategyCardDefinition) =>
  card.secondaryCostsStrategyToken &&
  state.actionPhase?.secondary?.free.includes(player) !== true &&
  !freeSecondary(state, player, card.mechanic);

function secondaryCostCheck(
  state: GameState,
  player: PlayerId,
  card: StrategyCardDefinition,
): Check {
  const tokens = findPlayer(state, player)?.commandPools.strategy ?? 0;
  return guard(
    !paysStrategyToken(state, player, card) || tokens > 0,
    'action.noStrategyToken',
    'Kein Marker im Strategiepool',
  );
}

function secondaryEvents(
  state: GameState,
  command: ResolveSecondary,
  context: DecisionContext,
): Events {
  const { issuedBy: player, choice } = command;
  const definition = definitionOf(context, state.actionPhase?.secondary?.card);
  return andThen(resolveEffect(definition), ({ card, effect }) =>
    andThen(secondaryCostCheck(state, player, card), () =>
      map(effect.secondary({ state, player, card, choice, context }), (events) => {
        const paidStrategyToken = paysStrategyToken(state, player, card);
        const resolved: GameEvent = { type: 'SecondaryResolved', player, paidStrategyToken };
        return [resolved, ...events, ...afterSecondary(state, player)];
      }),
    ),
  );
}

export const resolveSecondaryHandler = {
  commandType: 'ResolveSecondary',
  decide(state: GameState, command: ResolveSecondary, context: DecisionContext): Events {
    const checked = secondaryChecks(state, command.issuedBy);
    return checked.ok ? secondaryEvents(state, command, context) : checked;
  },
} as const satisfies CommandHandler<GameState, ResolveSecondary, GameEvent>;

export const declineSecondaryHandler = {
  commandType: 'DeclineSecondary',
  decide(state: GameState, command: DeclineSecondary): Events {
    const checked = secondaryChecks(state, command.issuedBy);
    if (!checked.ok) return checked;
    return ok([
      { type: 'SecondaryDeclined', player: command.issuedBy },
      ...afterSecondary(state, command.issuedBy),
    ]);
  },
} as const satisfies CommandHandler<GameState, DeclineSecondary, GameEvent>;

/** RR 4.3: Passen erst, wenn alle eigenen Strategiekarten genutzt wurden. */
export const passHandler = {
  commandType: 'Pass',
  decide(state: GameState, command: Pass): Events {
    const unused = strategyCardsOf(state, command.issuedBy).some((card) => !card.exhausted);
    const checked = firstFailure([
      ...activeTurnChecks(state, command.issuedBy),
      guard(!unused, 'action.strategyCardUnused', 'Erst die eigene Strategiekarte nutzen'),
    ]);
    if (!checked.ok) return checked;
    const passed = [...(state.actionPhase?.passed ?? []), command.issuedBy];
    return ok([
      { type: 'PlayerPassed', player: command.issuedBy },
      ...endTurn(state, command.issuedBy, passed),
    ]);
  },
} as const satisfies CommandHandler<GameState, Pass, GameEvent>;
