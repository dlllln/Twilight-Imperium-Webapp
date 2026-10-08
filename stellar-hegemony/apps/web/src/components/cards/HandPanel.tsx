import { Hand } from 'lucide-react';
import { Panel } from '../ui/Panel.tsx';
import { type GameState, handCards, type PlayerId } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useViewer } from '../../game-store.ts';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { CardItem } from './CardItem.tsx';

function HandTitle({ game, player }: { readonly game: GameState; readonly player: PlayerId }) {
  const t = useT();
  return (
    <>
      {t('actionCards')} · {t('handOf')} <PlayerTag game={game} id={player} />
    </>
  );
}

/** Die eigene Hand (online) bzw. die des Spielers, der gerade am Bildschirm entscheidet (RR 3). */
export function HandPanel({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const player = useViewer(game);
  if (player === null) return null;
  const cards = handCards(game, player, content);
  return (
    <Panel
      title={<HandTitle game={game} player={player} />}
      icon={Hand}
      tutorial="hand"
      className="hand-panel"
    >
      {cards.length === 0 ? (
        <p className="hint">{t('emptyHand')}</p>
      ) : (
        <ul className="action-cards">
          {cards.map((card) => (
            <CardItem
              key={`${player}-${card.definition.id}-${String(game.version)}`}
              {...{ game, player, card }}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
