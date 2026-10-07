import type { GameState, PhaseName } from '@stellar/domain';
import type { ReactElement } from 'react';
import type { MessageKey } from '../../i18n.ts';
import { currentActor } from '../../local-game.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from './PlayerTag.tsx';

const PHASES: readonly (readonly [PhaseName, MessageKey])[] = [
  ['strategy', 'phase.strategy'],
  ['action', 'phase.action'],
  ['status', 'phase.status'],
  ['agenda', 'phase.agenda'],
];

/** Phasenleiste: Runde, aktuelle Phase, Sprecher und wer gerade entscheidet. */
export function PhaseBar({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const actor = currentActor(game);
  return (
    <nav className="phase-bar glass" aria-label={t('round')} data-tutorial="phases">
      <strong className="round">
        {t('round')} {game.round}
      </strong>
      <ol className="phases">
        {PHASES.map(([phase, key]) => (
          <li key={phase} aria-current={phase === game.phase ? 'step' : undefined}>
            {t(key)}
          </li>
        ))}
      </ol>
      <span>
        {t('speaker')}: <PlayerTag game={game} id={game.speaker} />
      </span>
      {actor !== null && (
        <span className="actor" data-testid="actor">
          {t('onTurn')}: <PlayerTag game={game} id={actor} />
        </span>
      )}
    </nav>
  );
}
