import { HIDDEN, type GameEvent, type GameState, type PlayerId } from '@stellar/domain';
import {
  actionFrame,
  explorationFrame,
  relicFrame,
  strategyFrame,
  type CardArtworkSource,
} from '../../artwork/cards.ts';
import { leaderFrame } from '../../artwork/leaders.ts';

export type TabletopKind = 'draw' | 'play' | 'discard' | 'spend' | 'gain' | 'exhaust' | 'purge';
export type TabletopItem =
  | 'action'
  | 'secret'
  | 'relic'
  | 'strategy'
  | 'goods'
  | 'planet'
  | 'leader'
  | 'agenda'
  | 'exploration';

/** Only public events and the viewer's own private cards may supply a face. */
export interface TabletopMove {
  readonly kind: TabletopKind;
  readonly item: TabletopItem;
  readonly player: PlayerId;
  readonly count: number;
  readonly artwork?: CardArtworkSource | undefined;
}

interface MoveInput {
  readonly game: GameState;
  readonly viewer: PlayerId | null;
}

type Movements = {
  readonly [K in GameEvent['type']]?: (
    event: Extract<GameEvent, { type: K }>,
    input: MoveInput,
  ) => TabletopMove | null;
};

const drawnAction = (
  event: Extract<GameEvent, { type: 'ActionCardsDrawn' }>,
  input: MoveInput,
): TabletopMove => ({
  kind: 'draw',
  item: 'action',
  player: event.player,
  count: event.cards.length,
  ...(event.player === input.viewer && event.cards[0] !== undefined && event.cards[0] !== HIDDEN
    ? { artwork: actionFrame(event.cards[0]) }
    : {}),
});

const MOVEMENTS: Movements = {
  ActionCardsDrawn: drawnAction,
  ActionCardPlayed: ({ player, card }) => ({
    kind: 'play',
    item: 'action',
    player,
    count: 1,
    artwork: actionFrame(card),
  }),
  ActionCardResolved: ({ player, card }) => ({
    kind: 'discard',
    item: 'action',
    player,
    count: 1,
    artwork: actionFrame(card),
  }),
  ActionCardsDiscarded: ({ player, cards }) => ({
    kind: 'discard',
    item: 'action',
    player,
    count: cards.length,
    ...(cards[0] === undefined ? {} : { artwork: actionFrame(cards[0]) }),
  }),
  SecretObjectiveDrawn: ({ player }) => ({ kind: 'draw', item: 'secret', player, count: 1 }),
  RelicDrawn: ({ player, relic }) => ({
    kind: 'draw',
    item: 'relic',
    player,
    count: 1,
    artwork: relicFrame(relic),
  }),
  TradeGoodsSpent: ({ player, amount }) => ({
    kind: 'spend',
    item: 'goods',
    player,
    count: amount,
  }),
  TradeGoodsGained: ({ player, amount }) => ({
    kind: 'gain',
    item: 'goods',
    player,
    count: amount,
  }),
  TradeGoodsCacheCollected: ({ player, amount }) => ({
    kind: 'gain',
    item: 'goods',
    player,
    count: amount,
  }),
  PlanetsExhausted: ({ player, planets }) => ({
    kind: 'exhaust',
    item: 'planet',
    player,
    count: planets.length,
  }),
  LeaderUsed: ({ player, leader, purged }) => ({
    kind: purged ? 'purge' : 'exhaust',
    item: 'leader',
    player,
    count: 1,
    artwork: leaderFrame(leader),
  }),
  RelicUsed: ({ player, relic, purged }) => ({
    kind: purged ? 'purge' : 'exhaust',
    item: 'relic',
    player,
    count: 1,
    artwork: relicFrame(relic),
  }),
  PlanetExplored: ({ player, card, deck }) => ({
    kind: 'draw',
    item: 'exploration',
    player,
    count: 1,
    artwork: explorationFrame(card, deck),
  }),
  FrontierExplored: ({ player, card }) => ({
    kind: 'draw',
    item: 'exploration',
    player,
    count: 1,
    artwork: explorationFrame(card, 'frontier'),
  }),
  StrategicActionPerformed: ({ player, card }, { game }) => {
    const strategy = game.strategyCards[card];
    return strategy === undefined
      ? null
      : {
          kind: 'exhaust',
          item: 'strategy',
          player,
          count: 1,
          artwork: strategyFrame(strategy.mechanic),
        };
  },
};

/** A reconnect or plain snapshot has no movements; no transactions are inferred from counts. */
export function tabletopMovements(
  events: readonly GameEvent[],
  input: MoveInput,
): readonly TabletopMove[] {
  return events.flatMap((event) => {
    const describe = MOVEMENTS[event.type] as
      ((value: GameEvent, context: MoveInput) => TabletopMove | null) | undefined;
    const movement = describe?.(event, input);
    return movement == null || movement.count <= 0 ? [] : [movement];
  });
}

export interface TabletopPile {
  readonly id: 'action' | 'agenda' | 'secret' | 'relic' | 'discard';
  readonly count: number;
  readonly artwork: CardArtworkSource;
}

const back = (path: string): CardArtworkSource => ({
  path: `/ti4/cards/${path}-back.jpg`,
  columns: 1,
  rows: 1,
  index: 0,
});

/** Deck identities remain hidden even when called with an unmasked local test state. */
export function tabletopPiles(game: GameState): readonly TabletopPile[] {
  const discarded = game.actionDeck.discard.at(-1);
  return [
    { id: 'action', count: game.actionDeck.deck.length, artwork: back('action') },
    { id: 'agenda', count: game.agendaDeck.deck.length, artwork: back('agenda') },
    { id: 'secret', count: game.objectives.secretDeck.length, artwork: back('objective-secret') },
    { id: 'relic', count: game.exploration.relicDeck.length, artwork: back('relic') },
    {
      id: 'discard',
      count: game.actionDeck.discard.length,
      artwork: discarded === undefined ? back('action') : actionFrame(discarded),
    },
  ];
}
