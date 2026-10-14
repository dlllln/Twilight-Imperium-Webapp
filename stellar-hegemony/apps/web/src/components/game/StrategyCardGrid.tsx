import { Panel } from '../ui/Panel.tsx';
import { Layers } from 'lucide-react';
import type { GameState, StrategyCardState } from '@stellar/domain';
import type { ReactElement } from 'react';
import { strategyArtwork } from '../../artwork/cards.ts';
import { useHumanActor } from '../../game-store.ts';
import { seatColor } from '../../seat-colors.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { strategyLook } from '../../hand/card-look.ts';
import { CardArtwork } from '../cards/CardArtwork.tsx';
import { cardText } from './card-text.ts';

function StrategyCardTile({
  card,
  game,
}: {
  readonly card: StrategyCardState;
  readonly game: GameState;
}): ReactElement {
  const language = useLanguage();
  const text = cardText(card.id);
  const holder = game.players.find((player) => player.id === card.holder);
  return (
    <li className={`strategy-card${card.exhausted ? ' exhausted' : ''}`}>
      <div
        className="strategy-tile"
        data-look={strategyLook(card.mechanic)}
        title={text.primary[language]}
      >
        <CardArtwork artwork={strategyArtwork(card.mechanic)} className="ti4-strategy-art" />
        <span className="initiative">{card.initiative}</span>
        <span className="card-name">{text.name[language]}</span>
        {holder !== undefined && (
          <span className="swatch" style={{ background: seatColor(holder.seat + 1) }} />
        )}
        {card.tradeGoods > 0 && <span className="goods">+{card.tradeGoods}</span>}
      </div>
    </li>
  );
}

/** Übersicht der Kartenauslage: wer welche Karte hält; genommen wird sie aus der Hand. */
export function StrategyCardGrid({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const human = useHumanActor(game);
  const cards = Object.values(game.strategyCards).sort((a, b) => a.initiative - b.initiative);
  return (
    <Panel title={t('strategyCards')} icon={Layers} tutorial="strategy">
      {game.phase === 'strategy' && human !== null && <p className="hint">{t('pickHint')}</p>}
      <ul className="card-grid">
        {cards.map((card) => (
          <StrategyCardTile key={card.id} card={card} game={game} />
        ))}
      </ul>
    </Panel>
  );
}
