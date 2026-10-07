import { useEffect } from 'react';
import { useGameStore } from '../game-store.ts';
import { useSettingsStore } from '../settings-store.ts';
import { soundCues, turnCue } from './sound-cues.ts';
import { type SoundPort, SynthSound } from './synth-sound.ts';

/** Kleiner Abstand, damit mehrere Klänge eines Zugs nicht übereinanderliegen. */
const CUE_GAP_MS = 160;

let port: SoundPort | null = null;

/** Für Tests: eine Attrappe statt Web Audio. */
export const setSoundPort = (next: SoundPort | null): void => {
  port = next;
};

const soundPort = (): SoundPort => (port ??= new SynthSound());

/** Spielt zu jedem Zug die passenden Klänge; online zusätzlich ein Signal, wenn man dran ist. */
export function useSoundEffects(): void {
  const last = useGameStore((state) => state.lastEvents);
  useEffect(() => {
    const { sound, volume } = useSettingsStore.getState();
    const { game, me } = useGameStore.getState();
    if (last === null || game === null || !sound) return;
    const turn = turnCue(last.before, game, me);
    const cues = [...soundCues(last.events), ...(turn === null ? [] : [turn])];
    const timers = cues.map((cue, index) =>
      setTimeout(() => soundPort().play(cue, volume), index * CUE_GAP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [last]);
}
