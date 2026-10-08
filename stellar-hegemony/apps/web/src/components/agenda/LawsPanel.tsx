import { Panel } from '../ui/Panel.tsx';
import { Scale } from 'lucide-react';
import type { GameState } from '@stellar/domain';
import type { ReactElement } from 'react';
import { agendaLabel, agendaPassedText } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';

/** RR 1.3/1.4: alle geltenden Gesetze, mit Besitzer, sobald einer gewählt wurde. */
export function LawsPanel({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  if (!game.centerTokenRemoved && game.laws.length === 0) return null;
  return (
    <Panel title={t('lawsInForce')} icon={Scale} className="laws-panel">
      {game.laws.length === 0 ? (
        <p className="hint">{t('noLaws')}</p>
      ) : (
        <ul>
          {game.laws.map((law) => (
            <li key={law.agenda} title={agendaPassedText(law.agenda, language)}>
              <strong>{agendaLabel(law.agenda, language)}</strong>
              {law.owner !== null && <PlayerTag game={game} id={law.owner} />}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
