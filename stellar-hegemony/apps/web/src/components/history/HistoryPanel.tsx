import { findPlayer, type GameState, type PlayerId } from '@stellar/domain';
import { History } from 'lucide-react';
import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import type { HistoryLine } from '../../history/turn-history.ts';
import type { Language, MessageKey } from '../../i18n.ts';
import { objectiveLabel, planetLabel, systemLabel, technologyLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { cardText } from '../game/card-text.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { Panel } from '../ui/Panel.tsx';

type Words = Readonly<Record<string, string | number>>;

const nameOf = (game: GameState, id: PlayerId): string => findPlayer(game, id)?.name ?? id;

/** Die Lücken einer Zeile in der gewählten Sprache: Systeme, Planeten, Karten, Mitspieler. */
function wordsOf(line: HistoryLine, game: GameState, language: Language): Words {
  return {
    ...line,
    ...('system' in line ? { system: systemLabel(game, line.system, language) } : {}),
    ...('planet' in line ? { planet: planetLabel(line.planet, language) } : {}),
    ...('card' in line ? { card: cardText(line.card).name[language] } : {}),
    ...('technology' in line ? { technology: technologyLabel(line.technology, language) } : {}),
    ...('objective' in line ? { objective: objectiveLabel(line.objective, language) } : {}),
    ...('rival' in line ? { rival: nameOf(game, line.rival) } : {}),
  };
}

const fill = (text: string, words: Words): string =>
  text.replace(/\{(\w+)\}/g, (gap, key: string) => String(words[key] ?? gap));

function Entry({ line, game }: { readonly line: HistoryLine; readonly game: GameState }) {
  const t = useT();
  const language = useLanguage();
  const text = fill(t(`history.${line.kind}` as MessageKey), wordsOf(line, game, language));
  if (!('player' in line)) return <li className="history-round">{text}</li>;
  return (
    <li>
      <PlayerTag game={game} id={line.player} /> {text}
    </li>
  );
}

/** „Was ist passiert?“: die letzten Züge aller Spieler, das Neueste oben. */
export function HistoryPanel({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const history = useGameStore((state) => state.history);
  return (
    <Panel title={t('historyTitle')} icon={History} className="history-panel">
      {history.length === 0 ? (
        <p className="hint">{t('historyEmpty')}</p>
      ) : (
        <ol className="history-list">
          {[...history].reverse().map((entry) => (
            <Entry key={entry.id} line={entry.line} game={game} />
          ))}
        </ol>
      )}
    </Panel>
  );
}
