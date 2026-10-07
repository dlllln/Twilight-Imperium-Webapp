import type { ReactElement } from 'react';
import { type Language, type MessageKey, translate } from '../i18n.ts';
import { useGameStore } from '../game-store.ts';
import { useOnlineStore } from '../online/online-store.ts';
import { useSettingsStore } from '../settings-store.ts';
import { useGalaxyStore } from '../store.ts';
import { useTutorialStore } from '../tutorial/tutorial-store.ts';

const PLAYER_COUNTS = [3, 4, 5, 6] as const;
const LANGUAGES: readonly Language[] = ['de', 'en'];
const TOGGLES = [
  ['sound', 'soundToggle'],
  ['animations', 'animationsToggle'],
  ['tips', 'tipsToggle'],
] as const;

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

function VolumeSlider({ label }: { readonly label: string }): ReactElement {
  const { volume, setVolume } = useSettingsStore();
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.1}
      value={volume}
      aria-label={label}
      onChange={(event) => setVolume(Number(event.target.value))}
    />
  );
}

/** Klang, Animationen und Tipps an- und ausschalten; dazu die Anleitung. */
function SettingsGroup({ t }: { readonly t: Translate }): ReactElement {
  const settings = useSettingsStore();
  const startGuide = useTutorialStore((state) => state.start);
  return (
    <div className="settings" role="group" aria-label={t('settings')}>
      {TOGGLES.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={settings[key]}
          onClick={() => settings.toggle(key)}
        >
          {t(label)}
        </button>
      ))}
      {settings.sound && <VolumeSlider label={t('volume')} />}
      <button type="button" onClick={startGuide}>
        {t('guide')}
      </button>
    </div>
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
    <button type="button" className="primary" onClick={begin}>
      {t('startGame')}
    </button>
  ) : (
    <button type="button" onClick={online ? leaveOnline : leave}>
      {t(online ? 'leaveOnline' : 'backToGalaxy')}
    </button>
  );
}

export function Toolbar(): ReactElement {
  const { language, generate } = useGalaxyStore();
  const playing = useGameStore((state) => state.game !== null);
  const code = useOnlineStore((state) => state.ticket?.code ?? null);
  const setup = !playing && code === null;
  const t = (key: MessageKey) => translate(language, key);
  const subtitle =
    code === null ? t(playing ? 'subtitleGame' : 'subtitle') : `${t('subtitleOnline')} · ${code}`;
  return (
    <header className="toolbar glass" data-tutorial="toolbar">
      <div className="brand">
        <h1>{t('title')}</h1>
        <span>{subtitle}</span>
      </div>
      {setup && <PlayerCountSelect label={t('players')} />}
      {setup && <BotCountSelect label={t('botOpponents')} />}
      {setup && (
        <button type="button" onClick={() => generate()}>
          {t('newGalaxy')}
        </button>
      )}
      <GameButton t={t} />
      <SettingsGroup t={t} />
      <LanguageSwitch />
    </header>
  );
}
