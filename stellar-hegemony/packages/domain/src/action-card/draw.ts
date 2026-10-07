import type { DecisionContext } from '../eventsourcing/command.ts';
import { chain } from '../game/event-chain.ts';
import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import { shuffle } from '../ports/random-port.ts';
import type { PlayerId } from '../shared/ids.ts';

/** RR 3.3: oberste Karten ziehen; reicht der Stapel nicht, wird die Ablage untergemischt. */
export function drawEvents(
  state: GameState,
  player: PlayerId,
  count: number,
  random: DecisionContext['random'],
): readonly GameEvent[] {
  const { deck, discard } = state.actionDeck;
  if (deck.length >= count)
    return [{ type: 'ActionCardsDrawn', player, cards: deck.slice(0, count) }];
  const refilled = [...deck, ...shuffle(random, discard)];
  return [
    { type: 'ActionDeckReshuffled', deck: refilled },
    { type: 'ActionCardsDrawn', player, cards: refilled.slice(0, count) },
  ];
}

/** Mehrere Spieler ziehen nacheinander; jeder sieht den Stapel nach dem vorigen. */
export const drawForAll = (
  state: GameState,
  players: readonly PlayerId[],
  count: number,
  random: DecisionContext['random'],
): readonly GameEvent[] =>
  chain(
    state,
    players.map((player) => (current: GameState) => drawEvents(current, player, count, random)),
  );

/** RR 3.4: so viele Karten muss der Spieler über dem Handkartenlimit ablegen. */
export function excessActionCards(state: GameState, player: PlayerId): number {
  const hand = state.players.find((p) => p.id === player)?.actionCards.length ?? 0;
  return Math.max(0, hand - state.config.rules.actionCardHandLimit);
}
