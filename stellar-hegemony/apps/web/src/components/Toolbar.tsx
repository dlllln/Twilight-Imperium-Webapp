import { BookOpen, LogOut, Play, Shuffle } from 'lucide-react';
import type { ReactElement } from 'react';
import { SettingsMenu } from './SettingsMenu.tsx';
import { type Language, type MessageKey, translate } from '../i18n.ts';
import { useGameStore } from '../game-store.ts';
import { useOnlineStore } from '../online/online-store.ts';
import { useGalaxyStore } from '../store.ts';
import { useTutorialStore } from '../tutorial/tutorial-store.ts';

const PLAYER_COUNTS = [3, 4, 5, 6] as const;
const LANGUAGES: readonly Language[] = ['de', 'en'];

/** Eigenes Zeichen: ein Sechseck mit Stern, passend zur Karte. */
function BrandMark(): ReactElement {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" />
      <path d="M20 9 L22.6 17.4 L31 20 L22.6 22.6 L20 31 L17.4 22.6 L9 20 L17.4 17.4 Z" />
    </svg>
  );
}

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

/** KI-Gegner übernehmen die letzten Plätze; der erste Platz bleibt immer menschlich. */
function BotCountSelect({ label }: { readonly label: string }): ReactElement {
  const { playerCount, botCount, setBotCount } = useGalaxyStore();
  return (
    <label>
      {label}
      <select
        value={botCount}
        onChange={(event) => setBotCount(Number(event.target.value))}
        aria-label={label}
      >
        {Array.from({ length: playerCount }, (_, count) => (
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

type Translate = (key: MessageKey) => string;

function GuideButton({ t }: { readonly t: Translate }): ReactElement {
  const startGuide = useTutorialStore((state) => state.start);
  return (
    <button type="button" className="icon-button" onClick={startGuide}>
      <BookOpen size={18} aria-hidden="true" /> {t('guide')}
    </button>
  );
}

function GameButton({ t }: { readonly t: Translate }): ReactElement | null {
  const { game, start, leave } = useGameStore();
  const online = useOnlineStore((state) => state.ticket !== null);
  const leaveOnline = useOnlineStore((state) => state.leave);
  const { layout, playerCount, botCount } = useGalaxyStore();
  const begin = () => start(layout, playerCount, undefined, botCount);
  if (online && game === null) return null;
  return game === null ? (
    <button type="button" className="primary icon-button" onClick={begin}>
      <Play size={18} aria-hidden="true" /> {t('startGame')}
    </button>
  ) : (
    <button type="button" className="icon-button" onClick={online ? leaveOnline : leave}>
      <LogOut size={18} aria-hidden="true" /> {t(online ? 'leaveOnline' : 'backToGalaxy')}
    </button>
  );
}

/** Vor der Partie: Spielerzahl, KI-Gegner, neue Galaxie. */
function SetupControls({ t }: { readonly t: Translate }): ReactElement {
  const generate = useGalaxyStore((state) => state.generate);
  return (
    <>
      <PlayerCountSelect label={t('players')} />
      <BotCountSelect label={t('botOpponents')} />
      <button type="button" className="icon-button" onClick={() => generate()}>
        <Shuffle size={18} aria-hidden="true" /> {t('newGalaxy')}
      </button>
    </>
  );
}

export function Toolbar(): ReactElement {
  const language = useGalaxyStore((state) => state.language);
  const playing = useGameStore((state) => state.game !== null);
  const code = useOnlineStore((state) => state.ticket?.code ?? null);
  const setup = !playing && code === null;
  const t = (key: MessageKey) => translate(language, key);
  const subtitle =
    code === null ? t(playing ? 'subtitleGame' : 'subtitle') : `${t('subtitleOnline')} · ${code}`;
  return (
    <header className="toolbar glass" data-tutorial="toolbar">
      <div className="brand">
        <BrandMark />
        <h1>{t('title')}</h1>
        <span>{subtitle}</span>
      </div>
      {setup && <SetupControls t={t} />}
      <GameButton t={t} />
      <div className="toolbar-end">
        <GuideButton t={t} />
        <SettingsMenu />
        <LanguageSwitch />
      </div>
    </header>
  );
}
