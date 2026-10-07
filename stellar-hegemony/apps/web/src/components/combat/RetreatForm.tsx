import type { GameState, PlayerId, SystemId } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { systemLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';

/** RR 63.5 Schritt 2: Rückzug ankündigen oder weiterkämpfen. */
export function RetreatForm({
  game,
  player,
  targets,
}: {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly targets: readonly SystemId[];
}): ReactElement {
  const t = useT();
  const language = useLanguage();
  const send = useGameStore((state) => state.send);
  const declare = (to: SystemId | null) => send({ type: 'DeclareRetreat', issuedBy: player, to });
  return (
    <div className="combat-decision">
      <h3>{t('retreatPrompt')}</h3>
      <div className="retreat-choices">
        <button type="button" className="primary" onClick={() => declare(null)}>
          {t('fightOn')}
        </button>
        {targets.map((target) => (
          <button key={target} type="button" onClick={() => declare(target)}>
            {t('retreatTo')} {systemLabel(game, target, language)}
          </button>
        ))}
      </div>
    </div>
  );
}
