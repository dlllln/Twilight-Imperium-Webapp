import { type GameState, ownedTechnologies } from '@stellar/domain';
import type { ReactElement } from 'react';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { TechnologyChip } from './TechnologyChip.tsx';

/** Erforschte Technologien aller Spieler (RR 80.1: offen ausliegend). */
export function TechnologyPanel({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  return (
    <section className="game-section">
      <h2>{t('technologies')}</h2>
      <ul className="tech-owners">
        {game.players.map((player) => (
          <li key={player.id}>
            <PlayerTag game={game} id={player.id} />
            <span className="tech-chips">
              {ownedTechnologies(game, player.id, content).map((technology) => (
                <TechnologyChip key={technology.id} technology={technology} />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
