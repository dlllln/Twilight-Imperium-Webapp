import { type ActionTiming, type GameState, handCards, type PlayerId } from '@stellar/domain';
import type { ReactElement } from 'react';
import { content } from '../../store.ts';
import { CardItem } from './CardItem.tsx';

interface PlayableProps {
  readonly game: GameState;
  readonly player: PlayerId;
  /** Nur Karten mit diesen Zeitangaben; ohne Angabe alle gerade spielbaren. */
  readonly timings?: readonly ActionTiming[];
}

/** Die jetzt spielbaren Karten eines Spielers, z. B. in der Kampfansicht. */
export function PlayableCards({ game, player, timings }: PlayableProps): ReactElement | null {
  const cards = handCards(game, player, content).filter(
    (card) => card.playable && (timings === undefined || timings.includes(card.definition.timing)),
  );
  if (cards.length === 0) return null;
  return (
    <ul className="action-cards">
      {cards.map((card) => (
        <CardItem key={`${player}-${card.definition.id}`} game={game} player={player} card={card} />
      ))}
    </ul>
  );
}
