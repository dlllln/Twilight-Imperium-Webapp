import { useSettingsStore } from '../settings-store.ts';
import type { SoundCue } from './sound-cues.ts';
import { soundPort } from './use-sound-effects.ts';

/** Klänge, die Gesten am Tisch begleiten, nicht Ereignisse der Partie. */
export type TableCue = Extract<
  SoundCue,
  'exhaust' | 'ready' | 'coin' | 'token' | 'draw' | 'reveal' | 'gavel'
>;

/** Tischklänge sind leiser als die Klänge der Partie: Sie begleiten jede einzelne Geste. */
export const TABLE_GAIN = 0.4;

interface CueSettings {
  readonly sound: boolean;
  readonly tableSounds: boolean;
  readonly volume: number;
}

/** Lautstärke eines Tischklangs; `null`, wenn Klang oder Tischklänge aus sind. */
export function tableCueVolume(settings: CueSettings): number | null {
  if (!settings.sound || !settings.tableSounds) return null;
  const volume = settings.volume * TABLE_GAIN;
  return volume > 0 ? volume : null;
}

/** Spielt einen Tischklang mit den aktuellen Einstellungen; stumm geschaltet geschieht nichts. */
export function playTableCue(cue: TableCue | null): void {
  if (cue === null) return;
  const volume = tableCueVolume(useSettingsStore.getState());
  if (volume !== null) soundPort().play(cue, volume);
}
