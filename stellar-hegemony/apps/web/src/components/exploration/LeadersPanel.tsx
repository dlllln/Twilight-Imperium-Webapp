import {
  type GameState,
  leaderProgress,
  leadersOf,
  type LeaderView,
  type PlayerId,
} from '@stellar/domain';
import { Medal } from 'lucide-react';
import type { ReactElement } from 'react';
import type { MessageKey } from '../../i18n.ts';
import { leaderEffect, leaderLabel, leaderUnlock } from '../../labels.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { LEADER_KIND_KEYS } from '../hand/HandFaces.tsx';
import { Panel } from '../ui/Panel.tsx';

/** Zustand in Worten; ein freier Kommandant wirkt dauerhaft und heißt deshalb „aktiv“. */
function statusKey(leader: LeaderView): MessageKey {
  if (leader.status === 'locked') return 'leaderLocked';
  if (leader.status === 'purged') return 'leaderPurged';
  if (leader.kind === 'commander') return 'leaderActive';
  return leader.status === 'ready' ? 'leaderReady' : 'exhausted';
}

interface LeaderProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly leader: LeaderView;
}

/** Ein Anführer: Art, Name, Zustand; gesperrt mit Bedingung und Fortschritt, sonst die Wirkung. */
function LeaderRow({ game, player, leader }: LeaderProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const progress = leaderProgress(game, player, leader, content);
  const locked = leader.status === 'locked';
  return (
    <li className={`leader-row leader-${leader.status}`} data-testid={`leader-${leader.id}`}>
      <span className="leader-kind">{t(LEADER_KIND_KEYS[leader.kind])}</span>
      <strong className="leader-name">{leaderLabel(leader.id, language)}</strong>
      <span className="leader-status">
        {t(statusKey(leader))}
        {progress !== null && ` ${String(progress.current)}/${String(progress.needed)}`}
      </span>
      <small className="leader-text">
        {locked ? leaderUnlock(leader.id, language) : leaderEffect(leader.id, language)}
      </small>
    </li>
  );
}

/** PoK Anführer aller Spieler: je ein Agent, Kommandant und Held, alles öffentlich. */
export function LeadersPanel({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  return (
    <Panel title={t('leadersTitle')} icon={Medal} className="leaders-panel">
      {game.players.map((player) => (
        <section key={player.id} className="leader-player">
          <PlayerTag game={game} id={player.id} />
          <ul className="leader-list">
            {leadersOf(game, player.id, content).map((leader) => (
              <LeaderRow key={leader.id} game={game} player={player.id} leader={leader} />
            ))}
          </ul>
        </section>
      ))}
    </Panel>
  );
}
