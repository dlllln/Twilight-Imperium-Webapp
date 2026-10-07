import type { GameState } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { errorText } from '../../i18n.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { TechnologyPanel } from '../technology/TechnologyPanel.tsx';
import { PlayersPanel } from './PlayersPanel.tsx';
import { StrategyCardGrid } from './StrategyCardGrid.tsx';
import { TurnPanel } from './TurnPanel.tsx';

export function GameSidebar({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const language = useLanguage();
  const error = useGameStore((state) => state.error);
  return (
    <aside className="game-sidebar glass">
      {error !== null && (
        <p className="error" role="alert">
          {t('ruleError')}: {errorText(language, error.code)}
        </p>
      )}
      <TurnPanel game={game} />
      <StrategyCardGrid game={game} />
      <PlayersPanel game={game} />
      <TechnologyPanel game={game} />
    </aside>
  );
}
