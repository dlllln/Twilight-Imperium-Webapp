import type { GameState, PhaseName } from '@stellar/domain';
import {
  ClipboardCheck,
  Landmark,
  Megaphone,
  Layers,
  type LucideIcon,
  RefreshCcw,
  Swords,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactElement } from 'react';
import type { MessageKey } from '../../i18n.ts';
import { currentActor } from '../../local-game.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from './PlayerTag.tsx';

const PHASES: readonly (readonly [PhaseName, MessageKey, LucideIcon])[] = [
  ['strategy', 'phase.strategy', Layers],
  ['action', 'phase.action', Swords],
  ['status', 'phase.status', ClipboardCheck],
  ['agenda', 'phase.agenda', Landmark],
];

/** Ein Schritt der Phasenleiste; nur die aktuelle Phase zeigt ihren Namen, die Pille gleitet mit. */
function PhaseStep({
  label,
  icon: Icon,
  current,
}: {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly current: boolean;
}): ReactElement {
  return (
    <li aria-current={current ? 'step' : undefined} title={label}>
      {current && <motion.span layoutId="phase-pill" className="phase-pill" />}
      <Icon size={15} aria-hidden="true" />
      <span className="phase-label">{label}</span>
    </li>
  );
}

/** Phasenleiste in der Kopfzeile: Runde, aktuelle Phase, Sprecher und wer gerade entscheidet. */
export function PhaseBar({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const actor = currentActor(game);
  return (
    <nav className="phase-bar" aria-label={t('round')} data-tutorial="phases">
      <strong className="round" title={t('round')}>
        <RefreshCcw size={15} aria-hidden="true" /> {game.round}
      </strong>
      <ol className="phases">
        {PHASES.map(([phase, key, icon]) => (
          <PhaseStep key={phase} label={t(key)} icon={icon} current={phase === game.phase} />
        ))}
      </ol>
      <span className="speaker" title={t('speaker')}>
        <Megaphone size={15} aria-label={t('speaker')} />{' '}
        <PlayerTag game={game} id={game.speaker} />
      </span>
      {actor !== null && (
        <span className="actor" data-testid="actor">
          {t('onTurn')}: <PlayerTag game={game} id={actor} />
        </span>
      )}
    </nav>
  );
}
