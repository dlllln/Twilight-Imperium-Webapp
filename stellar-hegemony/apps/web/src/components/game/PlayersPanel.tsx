import { clockwiseFrom, type GameState, type PlayerState, strategyCardsOf } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from './PlayerTag.tsx';

function PlayerRow({
  game,
  player,
}: {
  readonly game: GameState;
  readonly player: PlayerState;
}): ReactElement {
  const t = useT();
  const cards = strategyCardsOf(game, player.id).map((card) => card.initiative);
  const { tactic, fleet, strategy } = player.commandPools;
  const passed = game.actionPhase?.passed.includes(player.id) ?? false;
  return (
    <li className={game.actionPhase?.active === player.id ? 'active' : undefined}>
      <PlayerTag game={game} id={player.id} />
      <span className="initiatives">{cards.join(' · ')}</span>
      <span title={`${t('tactic')} / ${t('fleet')} / ${t('strategy')}`}>
        {tactic}/{fleet}/{strategy}
      </span>
      <span title={t('reinforcements')}>+{player.reinforcementTokens}</span>
      <span title={t('tradeGoods')}>◆ {player.tradeGoods}</span>
      <span title={t('commodities')}>
        ◇ {player.commodities}/{player.commodityLimit}
      </span>
      {passed && <span className="badge">{t('passed')}</span>}
    </li>
  );
}

/** Spieler in Initiativreihenfolge (Aktionsphase) bzw. ab dem Sprecher. */
export function PlayersPanel({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const order =
    game.actionPhase?.order ?? clockwiseFrom(game, game.speaker ?? game.host).map((p) => p.id);
  const players = order.flatMap((id) => game.players.filter((player) => player.id === id));
  return (
    <section className="game-section">
      <h2>{t('initiativeOrder')}</h2>
      <ol className="player-list">
        {players.map((player) => (
          <PlayerRow key={player.id} game={game} player={player} />
        ))}
      </ol>
    </section>
  );
}
