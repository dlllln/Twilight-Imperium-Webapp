import * as Popover from '@radix-ui/react-popover';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import {
  Armchair,
  AudioLines,
  Languages,
  Lightbulb,
  type LucideIcon,
  Settings2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { ReactElement } from 'react';
import type { Language, MessageKey } from '../i18n.ts';
import { type Settings, useSettingsStore } from '../settings-store.ts';
import { useGalaxyStore } from '../store.ts';
import { useT } from '../use-translation.ts';

type Toggle = 'sound' | 'tableSounds' | 'animations' | 'tips' | 'tableView';

const TOGGLES: readonly (readonly [Toggle, MessageKey, LucideIcon])[] = [
  ['sound', 'soundToggle', Volume2],
  ['tableSounds', 'tableSoundsToggle', AudioLines],
  ['animations', 'animationsToggle', Sparkles],
  ['tips', 'tipsToggle', Lightbulb],
  ['tableView', 'tableViewToggle', Armchair],
];

function SwitchRow({
  setting,
  label,
  icon: Icon,
}: {
  readonly setting: Toggle;
  readonly label: string;
  readonly icon: LucideIcon;
}): ReactElement {
  const checked = useSettingsStore((state: Settings) => state[setting]);
  const toggle = useSettingsStore((state) => state.toggle);
  // Tischklänge schweigen mit dem Klang; der Schalter ruht dann mit.
  const muted = useSettingsStore((state) => setting === 'tableSounds' && !state.sound);
  const id = `setting-${setting}`;
  return (
    <div className="switch-row">
      <Icon size={16} aria-hidden="true" />
      <label htmlFor={id}>{label}</label>
      <Switch.Root
        id={id}
        className="ui-switch"
        checked={checked}
        disabled={muted}
        onCheckedChange={() => toggle(setting)}
      >
        <Switch.Thumb className="ui-switch-thumb" />
      </Switch.Root>
    </div>
  );
}

function VolumeSlider(): ReactElement {
  const t = useT();
  const { volume, sound, setVolume } = useSettingsStore();
  return (
    <Slider.Root
      className="ui-slider"
      value={[volume]}
      min={0}
      max={1}
      step={0.05}
      disabled={!sound}
      onValueChange={([next]) => setVolume(next ?? volume)}
    >
      <Slider.Track className="ui-slider-track">
        <Slider.Range className="ui-slider-range" />
      </Slider.Track>
      <Slider.Thumb className="ui-slider-thumb" aria-label={t('volume')} />
    </Slider.Root>
  );
}

const LANGUAGES: readonly Language[] = ['de', 'en'];

function LanguageSwitch(): ReactElement {
  const t = useT();
  const { language, setLanguage } = useGalaxyStore();
  return (
    <div className="volume-row">
      <span>
        <Languages size={16} aria-hidden="true" /> {t('language')}
      </span>
      <div className="languages" role="group" aria-label={t('language')}>
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
    </div>
  );
}

/** Klang, Tischklänge, Lautstärke, Animationen, Tipps, Tischansicht und Sprache in einem aufklappbaren Menü. */
export function SettingsMenu(): ReactElement {
  const t = useT();
  return (
    <Popover.Root>
      <Popover.Trigger className="round-button" aria-label={t('settings')} title={t('settings')}>
        <Settings2 size={18} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="ui-popover glass" sideOffset={8} align="end">
          {TOGGLES.map(([setting, label, icon]) => (
            <SwitchRow key={setting} setting={setting} label={t(label)} icon={icon} />
          ))}
          <div className="volume-row">
            <span>{t('volume')}</span>
            <VolumeSlider />
          </div>
          <LanguageSwitch />
          <Popover.Arrow className="ui-popover-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
