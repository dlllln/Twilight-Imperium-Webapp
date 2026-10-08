import type { GameState, PhaseName } from '@stellar/domain';
import {
  ClipboardCheck,
  Landmark,
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

/** Ein Schritt der Phasenleiste; die leuchtende Pille gleitet zur aktuellen Phase. */
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
    <li aria-current={current ? 'step' : undefined}>
      {current && <motion.span layoutId="phase-pill" className="phase-pill" />}
      <Icon size={15} aria-hidden="true" />
      <span>{label}</span>
    </li>
  );
}

/** Phasenleiste: Runde, aktuelle Phase, Sprecher und wer gerade entscheidet. */
export function PhaseBar({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const actor = currentActor(game);
  return (
    <nav className="phase-bar glass" aria-label={t('round')} data-tutorial="phases">
      <strong className="round">
        <RefreshCcw size={15} aria-hidden="true" /> {t('round')} {game.round}
      </strong>
      <ol className="phases">
        {PHASES.map(([phase, key, icon]) => (
          <PhaseStep key={phase} label={t(key)} icon={icon} current={phase === game.phase} />
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
