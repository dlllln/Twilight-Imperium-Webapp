import type { GameEvent } from '../game/game-events.ts';
import type { PlayerId } from '../shared/ids.ts';
import { HIDDEN, hidden, slotView } from './player-view.ts';

type Masks = {
  readonly [K in GameEvent['type']]?: (
    event: Extract<GameEvent, { type: K }>,
    viewer: PlayerId | null,
  ) => GameEvent;
};

const deck = <E extends { readonly deck: readonly string[] }>(event: E): E => ({
  ...event,
  deck: hidden(event.deck),
});

/** Je Event-Typ mit verdeckten Inhalten eine Maske; alle anderen Events sind öffentlich. */
const MASKS: Masks = {
  ActionDeckPrepared: deck,
  ActionDeckReshuffled: deck,
  AgendaDeckPrepared: deck,
  AgendaDeckReshuffled: deck,
  ObjectivesPrepared: (event) => ({
    ...event,
    public: event.public.map(slotView),
    secretDeck: hidden(event.secretDeck),
  }),
  ActionCardsDrawn: (event, viewer) =>
    event.player === viewer ? event : { ...event, cards: hidden(event.cards) },
  SecretObjectivesDealt: (event, viewer) =>
    event.player === viewer
      ? event
      : { ...event, choice: { ...event.choice, options: hidden(event.choice.options) } },
  SecretObjectivesKept: (event, viewer) => ({
    ...event,
    kept: event.player === viewer ? event.kept : hidden(event.kept),
    secretDeck: hidden(event.secretDeck),
  }),
  SecretObjectiveDrawn: (event, viewer) =>
    event.player === viewer ? event : { ...event, objective: HIDDEN as typeof event.objective },
};

function maskEvent(event: GameEvent, viewer: PlayerId | null): GameEvent {
  const mask = MASKS[event.type] as
    ((masked: GameEvent, who: PlayerId | null) => GameEvent) | undefined;
  return mask === undefined ? event : mask(event, viewer);
}

/** Events, wie ein Spieler sie erfährt: dieselben Masken wie `playerView`. */
export const visibleEvents = (
  events: readonly GameEvent[],
  viewer: PlayerId | null,
): readonly GameEvent[] => events.map((event) => maskEvent(event, viewer));
