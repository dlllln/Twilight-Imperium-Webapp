import { create } from 'zustand';

/** Was jeder Spieler für sich einstellt; bleibt im Browser gespeichert. */
export interface Settings {
  readonly sound: boolean;
  readonly volume: number;
  readonly animations: boolean;
  /** Kurze Hinweise zur aktuellen Phase im Zugfeld. */
  readonly tips: boolean;
  /** Den Bedienhinweis am Mauszeiger kennt man nach dem ersten Klick auf ein System. */
  readonly hintSeen: boolean;
  /** Die Hand bleibt eingeklappt, bis man sie braucht. */
  readonly handOpen: boolean;
}

export interface SettingsStore extends Settings {
  readonly toggle: (key: 'sound' | 'animations' | 'tips') => void;
  readonly setVolume: (volume: number) => void;
  readonly markHintSeen: () => void;
  readonly setHandOpen: (open: boolean) => void;
}

const KEY = 'stellar.settings';
const DEFAULT_VOLUME = 0.6;

/** Wer im Betriebssystem weniger Bewegung wünscht, startet ohne Animationen. */
const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const defaults = (): Settings => ({
  sound: true,
  volume: DEFAULT_VOLUME,
  animations: !prefersReducedMotion(),
  tips: false,
  hintSeen: false,
  handOpen: false,
});

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return { ...defaults(), ...saved };
  } catch {
    return defaults();
  }
}

function save(settings: Settings): void {
  try {
    const { sound, volume, animations, tips, hintSeen, handOpen } = settings;
    const saved = { sound, volume, animations, tips, hintSeen, handOpen };
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Ohne Speicher gelten die Einstellungen nur bis zum Neuladen.
  }
}

const clampVolume = (volume: number): number => Math.min(1, Math.max(0, volume));

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  ...load(),
  toggle: (key) => {
    set({ [key]: !get()[key] });
    save(get());
  },
  setVolume: (volume) => {
    set({ volume: clampVolume(volume) });
    save(get());
  },
  markHintSeen: () => {
    if (get().hintSeen) return;
    set({ hintSeen: true });
    save(get());
  },
  setHandOpen: (handOpen) => {
    set({ handOpen });
    save(get());
  },
}));
