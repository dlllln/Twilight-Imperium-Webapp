import type { ReactElement } from 'react';
import { type Language, translate } from '../i18n.ts';
import { useGalaxyStore } from '../store.ts';

const PLAYER_COUNTS = [3, 4, 5, 6] as const;
const LANGUAGES: readonly Language[] = ['de', 'en'];

function PlayerCountSelect({ label }: { readonly label: string }): ReactElement {
  const { playerCount, setPlayerCount } = useGalaxyStore();
  return (
    <label>
      {label}
      <select
        value={playerCount}
        onChange={(event) => setPlayerCount(Number(event.target.value))}
        aria-label={label}
      >
        {PLAYER_COUNTS.map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </select>
    </label>
  );
}

function LanguageSwitch(): ReactElement {
  const { language, setLanguage } = useGalaxyStore();
  return (
    <div className="languages" role="group">
      {LANGUAGES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === language}
          onClick={() => setLanguage(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function Toolbar(): ReactElement {
  const { language, generate } = useGalaxyStore();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return (
    <header className="toolbar glass">
      <div className="brand">
        <h1>{t('title')}</h1>
        <span>{t('subtitle')}</span>
      </div>
      <PlayerCountSelect label={t('players')} />
      <button type="button" onClick={() => generate()}>
        {t('newGalaxy')}
      </button>
      <LanguageSwitch />
    </header>
  );
}
