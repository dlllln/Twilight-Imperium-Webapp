import { withTactical } from '../combat/combat-reducers.ts';
import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { ActionCardId, PlayerId } from '../shared/ids.ts';
import type { Unit } from '../unit/unit.ts';
import type {
  ActionCardCancelled,
  ActionCardEvent,
  ActionCardPlayed,
  ActionCardsDiscarded,
  ActionCardsDrawn,
  HitsCancelled,
  ReactionPassed,
  ReactionWindowOpened,
  UnitsRepaired,
} from './action-card-events.ts';

/** Entfernt je genanntem Exemplar genau eine Karte (gleichnamige Karten bleiben erhalten). */
export function withoutCards(
  hand: readonly ActionCardId[],
  cards: readonly ActionCardId[],
): readonly ActionCardId[] {
  const remaining = [...hand];
  for (const card of cards) {
    const index = remaining.indexOf(card);
    if (index >= 0) remaining.splice(index, 1);
  }
  return remaining;
}

const fromHand = (state: GameState, player: PlayerId, cards: readonly ActionCardId[]) =>
  updatePlayer(state, player, (p) => ({ ...p, actionCards: withoutCards(p.actionCards, cards) }));

const toDiscard = (state: GameState, cards: readonly ActionCardId[]): GameState => ({
  ...state,
  actionDeck: { ...state.actionDeck, discard: [...state.actionDeck.discard, ...cards] },
});

function drawn(state: GameState, event: ActionCardsDrawn): GameState {
  const deck = state.actionDeck.deck.slice(event.cards.length);
  const next = updatePlayer(state, event.player, (p) => ({
    ...p,
    actionCards: [...p.actionCards, ...event.cards],
  }));
  return { ...next, actionDeck: { ...state.actionDeck, deck } };
}

const discarded = (state: GameState, event: ActionCardsDiscarded): GameState =>
  toDiscard(fromHand(state, event.player, event.cards), event.cards);

function played(state: GameState, event: ActionCardPlayed): GameState {
  const { player, card, target, awaiting } = event;
  const window = state.reactionWindow;
  const reactionWindow =
    window === null ? null : { ...window, played: [...window.played, { player, card }] };
  const pendingPlay = { player, card, target, awaiting };
  return { ...fromHand(state, player, [card]), reactionWindow, pendingPlay };
}

const cancelled = (state: GameState, event: ActionCardCancelled): GameState => ({
  ...toDiscard(fromHand(state, event.by, [event.with]), [event.card, event.with]),
  pendingPlay: null,
});

function opened(state: GameState, event: ReactionWindowOpened): GameState {
  const { kind, awaiting, key } = event;
  const marked = withTactical(state, (t) => ({ ...t, windows: [...t.windows, key] }));
  return { ...marked, reactionWindow: { kind, awaiting, played: [] } };
}

function passed(state: GameState, event: ReactionPassed): GameState {
  const window = state.reactionWindow;
  if (window === null) return state;
  const awaiting = window.awaiting.filter((player) => player !== event.player);
  return { ...state, reactionWindow: awaiting.length === 0 ? null : { ...window, awaiting } };
}

const hitsCancelled = (state: GameState, event: HitsCancelled): GameState =>
  withTactical(state, (t) => ({
    ...t,
    pendingHits: t.pendingHits
      .map((entry) =>
        entry.player === event.player ? { ...entry, hits: entry.hits - event.amount } : entry,
      )
      .filter((entry) => entry.hits > 0),
  }));

function repaired(state: GameState, event: UnitsRepaired): GameState {
  const repair = (units: readonly Unit[]) =>
    units.map((unit) => (unit.owner === event.player ? { ...unit, damaged: false } : unit));
  const systems = Object.fromEntries(
    Object.entries(state.systems).map(([id, s]) => [
      id,
      { ...s, spaceUnits: repair(s.spaceUnits) },
    ]),
  );
  const planets = Object.fromEntries(
    Object.entries(state.planets).map(([id, p]) => [id, { ...p, units: repair(p.units) }]),
  );
  return { ...state, systems, planets };
}

export const actionCardReducers: ReducerMap<GameState, ActionCardEvent> = {
  ActionDeckPrepared: (state, event) => ({
    ...state,
    actionDeck: { deck: event.deck, discard: [] },
  }),
  ActionDeckReshuffled: (state, event) => ({
    ...state,
    actionDeck: { deck: event.deck, discard: [] },
  }),
  ActionCardsDrawn: drawn,
  ActionCardsDiscarded: discarded,
  ActionCardPlayed: played,
  ActionCardCancelled: cancelled,
  CancelDeclined: (state, event) =>
    state.pendingPlay === null
      ? state
      : {
          ...state,
          pendingPlay: {
            ...state.pendingPlay,
            awaiting: state.pendingPlay.awaiting.filter((player) => player !== event.player),
          },
        },
  ActionCardResolved: (state, event) => ({ ...toDiscard(state, [event.card]), pendingPlay: null }),
  ReactionWindowOpened: opened,
  ReactionPassed: passed,
  CombatBonusGranted: (state, event) =>
    withTactical(state, (t) => ({ ...t, bonuses: [...t.bonuses, event.bonus] })),
  HitsCancelled: hitsCancelled,
  UnitsRepaired: repaired,
};
