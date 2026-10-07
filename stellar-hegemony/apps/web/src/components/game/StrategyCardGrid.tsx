import type { GameState, StrategyCardState } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useGameStore, useHumanActor } from '../../game-store.ts';
import { seatColor } from '../../seat-colors.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { cardText } from './card-text.ts';

interface TileProps {
  readonly card: StrategyCardState;
  readonly game: GameState;
  readonly onPick: (() => void) | undefined;
}

function StrategyCardTile({ card, game, onPick }: TileProps): ReactElement {
  const language = useLanguage();
  const text = cardText(card.id);
  const holder = game.players.find((player) => player.id === card.holder);
  return (
    <li className={`strategy-card${card.exhausted ? ' exhausted' : ''}`}>
      <button
        type="button"
        disabled={onPick === undefined}
        onClick={onPick}
        title={text.primary[language]}
      >
        <span className="initiative">{card.initiative}</span>
        <span className="card-name">{text.name[language]}</span>
        {holder !== undefined && (
          <span className="swatch" style={{ background: seatColor(holder.seat + 1) }} />
        )}
        {card.tradeGoods > 0 && <span className="goods">+{card.tradeGoods}</span>}
      </button>
    </li>
  );
}

/** Kartenauslage; in der Strategiephase wählt der Spieler am Zug per Klick. */
export function StrategyCardGrid({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const human = useHumanActor(game);
  const choosing = game.players.some((player) => player.secretChoice !== null);
  const actor = game.phase === 'strategy' && !choosing ? human : null;
  const cards = Object.values(game.strategyCards).sort((a, b) => a.initiative - b.initiative);
  const pick = (card: StrategyCardState) =>
    actor === null || card.holder !== null
      ? undefined
      : () => send({ type: 'PickStrategyCard', issuedBy: actor, card: card.id });
  return (
    <section className="game-section">
      <h2>{t('strategyCards')}</h2>
      {actor !== null && <p className="hint">{t('pickHint')}</p>}
      <ul className="card-grid">
        {cards.map((card) => (
          <StrategyCardTile key={card.id} card={card} game={game} onPick={pick(card)} />
        ))}
      </ul>
    </section>
  );
}
