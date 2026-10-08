import { Panel } from '../ui/Panel.tsx';
import { Users } from 'lucide-react';
import { clockwiseFrom, type GameState, type PlayerState, strategyCardsOf } from '@stellar/domain';
import type { ReactElement } from 'react';
import { seatPlayerId } from '@stellar/application';
import { useGameStore } from '../../game-store.ts';
import { useOnlineStore } from '../../online/online-store.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from './PlayerTag.tsx';

/** Kommandomarker, Nachschub, Handelswaren, Rohstoffe und Handkarten eines Spielers. */
function PlayerCounters({ player }: { readonly player: PlayerState }): ReactElement {
  const t = useT();
  const { tactic, fleet, strategy } = player.commandPools;
  return (
    <>
      <span title={`${t('tactic')} / ${t('fleet')} / ${t('strategy')}`}>
        {tactic}/{fleet}/{strategy}
      </span>
      <span title={t('reinforcements')}>+{player.reinforcementTokens}</span>
      <span title={t('tradeGoods')}>◆ {player.tradeGoods}</span>
      <span title={t('commodities')}>
        ◇ {player.commodities}/{player.commodityLimit}
      </span>
      <span title={t('handSize')} data-testid={`hand-${player.id}`}>
        ▤ {player.actionCards.length}
      </span>
    </>
  );
}

function PlayerRow({
  game,
  player,
}: {
  readonly game: GameState;
  readonly player: PlayerState;
}): ReactElement {
  const t = useT();
  const cards = strategyCardsOf(game, player.id).map((card) => card.initiative);
  const passed = game.actionPhase?.passed.includes(player.id) ?? false;
  const bot = useGameStore((state) => state.bots.includes(player.id));
  const offline = useOnlineStore((state) =>
    (state.lobby?.seats ?? []).some(
      (seat) => seatPlayerId(seat.seat) === player.id && seat.kind === 'human' && !seat.connected,
    ),
  );
  return (
    <li className={game.actionPhase?.active === player.id ? 'active' : undefined}>
      <PlayerTag game={game} id={player.id} />
      {bot && <span className="badge bot-badge">{t('botBadge')}</span>}
      <span className="initiatives">{cards.join(' · ')}</span>
      <PlayerCounters player={player} />
      {passed && <span className="badge">{t('passed')}</span>}
      {offline && <span className="badge offline-badge">{t('offline')}</span>}
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
    <Panel title={t('initiativeOrder')} icon={Users} tutorial="players">
      <ol className="player-list">
        {players.map((player) => (
          <PlayerRow key={player.id} game={game} player={player} />
        ))}
      </ol>
    </Panel>
  );
}
