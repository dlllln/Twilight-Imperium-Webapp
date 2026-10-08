import { findPlayer, type GameState } from '@stellar/domain';
import { Megaphone } from 'lucide-react';
import type { CSSProperties, ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { playerRail, type RailEntry } from '../../hud/hud-model.ts';
import { seatColor } from '../../seat-colors.ts';
import { useT } from '../../use-translation.ts';
import { useSidebarStore } from '../game/sidebar-store.ts';
import { FactionEmblem } from '../simulator/FactionEmblem.tsx';

/** Name im Band der Platzfarbe, dazu KI und gepasst. */
function NameBand({ name, entry }: { readonly name: string; readonly entry: RailEntry }) {
  const t = useT();
  const bot = useGameStore((state) => state.bots.includes(entry.id));
  return (
    <span className="portrait-name">
      {name}
      {bot && <small>{t('botBadge')}</small>}
      {entry.passed && <small>{t('passed')}</small>}
    </span>
  );
}

function Portrait({ game, entry }: { readonly game: GameState; readonly entry: RailEntry }) {
  const t = useT();
  const player = findPlayer(game, entry.id);
  const reveal = useSidebarStore((state) => state.reveal);
  if (player === undefined) return null;
  const status = [entry.active && 'active', entry.passed && 'passed'].filter(Boolean).join(' ');
  return (
    <li
      className={`hud-portrait ${status}`}
      style={{ '--seat': seatColor(player.seat + 1) } as CSSProperties}
    >
      <button type="button" onClick={() => reveal('players')} aria-label={player.name}>
        <FactionEmblem id={player.faction} size={44} />
        <span className="portrait-vp" title={t('victoryPoints')}>
          {player.victoryPoints}
        </span>
        {entry.initiatives.map((initiative) => (
          <span key={initiative} className="portrait-initiative">
            {initiative}
          </span>
        ))}
        <NameBand name={player.name} entry={entry} />
        {entry.speaker && (
          <Megaphone className="portrait-speaker" size={13} aria-label={t('speaker')} />
        )}
      </button>
    </li>
  );
}

/** Porträts aller Spieler links oben: Wappen, Siegpunkte, Strategiekarten, wer am Zug ist. */
export function PlayerRail({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  return (
    <ol className="hud-players" aria-label={t('initiativeOrder')}>
      {playerRail(game).map((entry) => (
        <Portrait key={entry.id} game={game} entry={entry} />
      ))}
    </ol>
  );
}
