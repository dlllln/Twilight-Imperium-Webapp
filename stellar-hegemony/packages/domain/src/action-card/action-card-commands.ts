import { endTurn } from '../action/action-commands.ts';
import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { ActionCardId, PlayerId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { ActionCardDefinition } from './action-card-definition.ts';
import { withoutCards } from './action-card-reducers.ts';
import type { ActionTarget, PendingPlay } from './action-card-state.ts';
import {
  chosen,
  effectUsable,
  resolveEffect,
  situation,
  targetCheck,
  targetOptions,
} from './card-effects.ts';
import { findActionCard, respondersFor, timingOpen } from './card-timing.ts';
import { excessActionCards } from './draw.ts';

export interface PlayActionCard extends Command<'PlayActionCard'> {
  readonly card: ActionCardId;
  readonly target: ActionTarget;
}

/** Im offenen Zeitfenster keine (weitere) Karte spielen oder eine Karte nicht verhindern. */
export type PassReaction = Command<'PassReaction'>;

export interface DiscardActionCards extends Command<'DiscardActionCards'> {
  readonly cards: readonly ActionCardId[];
}

type Events = Result<readonly GameEvent[], DomainError>;

const hand = (state: GameState, player: PlayerId) => findPlayer(state, player)?.actionCards ?? [];

/** Ob die Karten (mit Vielfachheit) alle auf der Hand liegen. */
const holdsAll = (state: GameState, player: PlayerId, cards: readonly ActionCardId[]) =>
  withoutCards(hand(state, player), cards).length === hand(state, player).length - cards.length;

function playChecks(
  state: GameState,
  command: PlayActionCard,
  card: ActionCardDefinition,
  context: DecisionContext,
): Check {
  const player = command.issuedBy;
  const input = situation(state, player, card.effect, context.content);
  const repeated = state.reactionWindow?.played.some(
    (entry) => entry.player === player && entry.card === card.id,
  );
  return firstFailure([
    guard(holdsAll(state, player, [card.id]), 'actionCard.notInHand', 'Karte nicht auf der Hand'),
    guard(timingOpen(state, player, card.timing), 'actionCard.wrongTiming', 'Falscher Zeitpunkt'),
    guard(repeated !== true, 'actionCard.sameName', 'Gleichnamige Karte schon gespielt'),
    guard(effectUsable(input), 'actionCard.notUsable', 'Die Karte hätte keine Wirkung'),
    targetCheck(targetOptions(input), command.target),
  ]);
}

/** Die offene Karte wirkt; eine Materialaktion beendet danach den Zug (RR 51). */
function resolution(state: GameState, pending: PendingPlay, context: DecisionContext) {
  const card = findActionCard(context.content, pending.card);
  if (card === undefined) return [];
  const input = {
    ...situation(state, pending.player, card.effect, context.content),
    target: chosen(pending.target),
    random: context.random,
  };
  const resolved: readonly GameEvent[] = [
    { type: 'ActionCardResolved', player: pending.player, card: pending.card },
    ...resolveEffect(input),
  ];
  if (card.timing !== 'action') return resolved;
  const after = resolved.reduce(evolveGame, state);
  return [...resolved, ...endTurn(after, pending.player, after.actionPhase?.passed ?? [])];
}

/** RR 3.8: Die verhinderte Karte bleibt ohne Wirkung; eine Materialaktion verbraucht keinen Zug. */
function cancelEvents(state: GameState, player: PlayerId, card: ActionCardId): Events {
  const pending = state.pendingPlay;
  if (pending === null)
    return err(domainError('actionCard.nothingToCancel', 'Nichts zu verhindern'));
  return ok([
    {
      type: 'ActionCardCancelled',
      player: pending.player,
      card: pending.card,
      by: player,
      with: card,
    },
  ]);
}

function playEvents(state: GameState, command: PlayActionCard, context: DecisionContext): Events {
  const { issuedBy: player, card, target } = command;
  const awaiting = respondersFor(state, 'cancel', context.content, player);
  const played: GameEvent = { type: 'ActionCardPlayed', player, card, target, awaiting };
  if (awaiting.length > 0) return ok([played]);
  const pending = { player, card, target, awaiting };
  return ok([played, ...resolution(evolveGame(state, played), pending, context)]);
}

export const playActionCardHandler = {
  commandType: 'PlayActionCard',
  decide(state: GameState, command: PlayActionCard, context: DecisionContext): Events {
    const card = findActionCard(context.content, command.card);
    if (card === undefined) return err(domainError('actionCard.unknown', 'Unbekannte Karte'));
    const checked = playChecks(state, command, card, context);
    if (!checked.ok) return checked;
    return card.timing === 'cancel'
      ? cancelEvents(state, command.issuedBy, card.id)
      : playEvents(state, command, context);
  },
} as const satisfies CommandHandler<GameState, PlayActionCard, GameEvent>;

export const passReactionHandler = {
  commandType: 'PassReaction',
  decide(state: GameState, command: PassReaction, context: DecisionContext): Events {
    const player = command.issuedBy;
    const pending = state.pendingPlay;
    if (pending?.awaiting[0] === player) {
      const declined: GameEvent = { type: 'CancelDeclined', player };
      if (pending.awaiting.length > 1) return ok([declined]);
      return ok([declined, ...resolution(evolveGame(state, declined), pending, context)]);
    }
    if (pending === null && state.reactionWindow?.awaiting[0] === player)
      return ok([{ type: 'ReactionPassed', player }]);
    return err(domainError('reaction.notYourTurn', 'Du bist im Zeitfenster nicht an der Reihe'));
  },
} as const satisfies CommandHandler<GameState, PassReaction, GameEvent>;

/** RR 3.4: über dem Handkartenlimit genau die überzähligen Karten ablegen. */
export const discardActionCardsHandler = {
  commandType: 'DiscardActionCards',
  decide(state: GameState, command: DiscardActionCards): Events {
    const { issuedBy: player, cards } = command;
    const excess = excessActionCards(state, player);
    const checked = firstFailure([
      guard(excess > 0, 'actionCard.noDiscard', 'Du bist nicht über dem Limit'),
      guard(cards.length === excess, 'actionCard.discardCount', 'Falsche Anzahl', { excess }),
      guard(holdsAll(state, player, cards), 'actionCard.notInHand', 'Karte nicht auf der Hand'),
    ]);
    if (!checked.ok) return checked;
    return ok([{ type: 'ActionCardsDiscarded', player, cards }]);
  },
} as const satisfies CommandHandler<GameState, DiscardActionCards, GameEvent>;
