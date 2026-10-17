import { currentActor, type GameState } from '@stellar/domain';
import { Flag, SkipForward, Undo2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useCanUndo, useGameStore, useHumanActor } from '../../game-store.ts';
import { endTurnOf } from '../../hud/hud-model.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';

const PHASE_KEYS = {
  setup: 'phase.strategy',
  strategy: 'phase.strategy',
  action: 'phase.action',
  status: 'phase.status',
  agenda: 'phase.agenda',
  gameOver: 'phase.status',
} as const satisfies Record<GameState['phase'], string>;

/** Zug beenden oder passen, je nachdem, was gerade ansteht. */
function EndTurnButton({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const actor = useHumanActor(game);
  const send = useGameStore((state) => state.send);
  const end = endTurnOf(game, actor);
  if (end === null || actor === null) return null;
  if (end.kind === 'pass')
    return (
      <button
        type="button"
        className="hex-button"
        title={t('pass')}
        onClick={() => send({ type: 'Pass', issuedBy: actor })}
      >
        <Flag size={16} aria-hidden="true" /> {t('pass')}
      </button>
    );
  return (
    <button
      type="button"
      className="hex-button primary"
      title={t('endTurn')}
      disabled={!end.ready}
      onClick={() => send({ type: 'EndTacticalAction', issuedBy: actor })}
    >
      <SkipForward size={16} aria-hidden="true" /> {t('endTurn')}
    </button>
  );
}

/** Letzten eigenen Schritt zurücknehmen, solange niemand sonst seitdem gezogen hat. */
function UndoButton({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const undo = useGameStore((state) => state.undo);
  if (!useCanUndo(game)) return null;
  return (
    <button type="button" className="hex-button" onClick={undo} title={t('undoHint')}>
      <Undo2 size={16} aria-hidden="true" /> {t('undo')}
    </button>
  );
}

/** Unten rechts: aktuelle Phase, Runde, wer am Zug ist und der Knopf zum Beenden des Zugs. */
export function PhaseDock({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  return (
    <section key={game.phase} className="hud-phase" aria-label={t('currentPhase')}>
      <small>
        {t('currentPhase')} · {t('round')} {game.round}
      </small>
      <strong>{t(PHASE_KEYS[game.phase])}</strong>
      <span className="hud-actor">
        <PlayerTag game={game} id={currentActor(game)} />
      </span>
      <UndoButton game={game} />
      <EndTurnButton game={game} />
    </section>
  );
}
