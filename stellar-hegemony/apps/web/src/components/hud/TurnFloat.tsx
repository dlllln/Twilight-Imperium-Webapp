import type { GameState } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { errorText } from '../../i18n.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { TurnPanel } from '../game/TurnPanel.tsx';

function RuleError(): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  const error = useGameStore((state) => state.error);
  if (error === null) return null;
  return (
    <p className="error" role="alert">
      {t('ruleError')}: {errorText(language, error.code)}
    </p>
  );
}

/** Entscheidungen, die nicht an einem System hängen, schweben rechts über der Karte. */
export function TurnFloat({ game }: { readonly game: GameState }): ReactElement {
  return (
    <div className="turn-float">
      <RuleError />
      <TurnPanel game={game} />
    </div>
  );
}
