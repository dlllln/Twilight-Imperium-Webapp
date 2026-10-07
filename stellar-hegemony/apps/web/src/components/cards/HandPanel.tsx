import { type GameState, handCards } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useHumanActor } from '../../game-store.ts';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { CardItem } from './CardItem.tsx';

/** Hot-Seat: die Hand des Spielers, der gerade am Bildschirm entscheidet (RR 3). */
export function HandPanel({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const player = useHumanActor(game);
  if (player === null) return null;
  const cards = handCards(game, player, content);
  return (
    <section className="game-section hand-panel">
      <h2>
        {t('actionCards')} · {t('handOf')} <PlayerTag game={game} id={player} />
      </h2>
      {cards.length === 0 ? (
        <p className="hint">{t('emptyHand')}</p>
      ) : (
        <ul className="action-cards">
          {cards.map((card) => (
            <CardItem
              key={`${player}-${card.definition.id}-${String(game.version)}`}
              game={game}
              player={player}
              card={card}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
