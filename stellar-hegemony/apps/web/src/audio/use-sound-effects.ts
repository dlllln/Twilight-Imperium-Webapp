import { useEffect } from 'react';
import { useGameStore } from '../game-store.ts';
import { useSettingsStore } from '../settings-store.ts';
import { useSimulatorStore } from '../simulator/simulator-store.ts';
import { type SoundCue, soundCues, turnCue } from './sound-cues.ts';
import { type SoundPort, SynthSound } from './synth-sound.ts';

/** Kleiner Abstand, damit mehrere Klänge eines Zugs nicht übereinanderliegen. */
const CUE_GAP_MS = 160;

let port: SoundPort | null = null;

/** Für Tests: eine Attrappe statt Web Audio. */
export const setSoundPort = (next: SoundPort | null): void => {
  port = next;
};

/** Der eine Synthesizer der Seite; Partie- und Tischklänge teilen ihn. */
export const soundPort = (): SoundPort => (port ??= new SynthSound());

/** Jeder Teilklang liest die aktuellen Einstellungen, auch nach Stummschalten einer Folge. */
function queueCues(cues: readonly SoundCue[]): () => void {
  if (!useSettingsStore.getState().sound) return () => undefined;
  const timers = cues.map((cue, index) =>
    setTimeout(() => {
      const { sound, volume } = useSettingsStore.getState();
      if (sound) soundPort().play(cue, volume);
    }, index * CUE_GAP_MS),
  );
  return () => timers.forEach(clearTimeout);
}

function useGameSounds(): void {
  const last = useGameStore((state) => state.lastEvents);
  useEffect(() => {
    const { game, me } = useGameStore.getState();
    if (last === null || game === null) return;
    const turn = turnCue(last.before, game, me);
    return queueCues([...soundCues(last.events), ...(turn === null ? [] : [turn])]);
  }, [last]);
}

function useSimulatorSounds(): void {
  const report = useSimulatorStore((state) => state.report);
  useEffect(() => {
    if (report === null || useSimulatorStore.getState().stage !== 'battle') return;
    const cues: SoundCue[] = report.played.length > 0 ? ['card', 'dice'] : ['dice'];
    return queueCues(cues);
  }, [report]);
}

/** Klänge zu echten Spielereignissen, ohne Dauerschleife oder zusätzliche Zufallswürfe. */
export function useSoundEffects(): void {
  useGameSounds();
  useSimulatorSounds();
}
