import { findPlayer, type GameState, type PlayerId } from '@stellar/domain';
import { History } from 'lucide-react';
import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import type { HistoryLine } from '../../history/turn-history.ts';
import type { Language, MessageKey } from '../../i18n.ts';
import {
  explorationCardLabel,
  legendaryLabel,
  objectiveLabel,
  planetLabel,
  relicLabel,
  systemLabel,
  technologyLabel,
} from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { cardText } from '../game/card-text.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { Panel } from '../ui/Panel.tsx';

type Words = Readonly<Record<string, string | number>>;

const nameOf = (game: GameState, id: PlayerId): string => findPlayer(game, id)?.name ?? id;

type Lookup = (value: string, game: GameState, language: Language) => string;

/** Welche Lücke wie benannt wird: Systeme, Planeten, Karten, Funde, Relikte, Mitspieler. */
const LOOKUPS: Readonly<Record<string, Lookup>> = {
  system: (id, game, language) => systemLabel(game, id, language),
  planet: (id, _, language) => planetLabel(id, language),
  card: (id, _, language) => cardText(id).name[language],
  technology: (id, _, language) => technologyLabel(id, language),
  objective: (id, _, language) => objectiveLabel(id, language),
  rival: (id, game) => nameOf(game, id as PlayerId),
  find: (id, _, language) => explorationCardLabel(id, language),
  relic: (id, _, language) => relicLabel(id, language),
  ability: (id, _, language) => legendaryLabel(id, language),
};

/** Die Lücken einer Zeile in der gewählten Sprache. */
function wordsOf(line: HistoryLine, game: GameState, language: Language): Words {
  return Object.fromEntries(
    Object.entries(line).map(([key, value]: [string, string | number]) => {
      const lookup = LOOKUPS[key];
      const named = lookup !== undefined && typeof value === 'string';
      return [key, named ? lookup(value, game, language) : value];
    }),
  );
}

const fill = (text: string, words: Words): string =>
  text.replace(/\{(\w+)\}/g, (gap, key: string) => String(words[key] ?? gap));

/** Eine Zeile in Worten: wer (mit Farbe) und was; auch für die Benachrichtigungen. */
export function HistoryText({
  line,
  game,
}: {
  readonly line: HistoryLine;
  readonly game: GameState;
}): ReactElement {
  const t = useT();
  const language = useLanguage();
  const text = fill(t(`history.${line.kind}` as MessageKey), wordsOf(line, game, language));
  if (!('player' in line)) return <>{text}</>;
  return (
    <>
      <PlayerTag game={game} id={line.player} /> {text}
    </>
  );
}

function Entry({ line, game }: { readonly line: HistoryLine; readonly game: GameState }) {
  return (
    <li className={'player' in line ? undefined : 'history-round'}>
      <HistoryText line={line} game={game} />
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
