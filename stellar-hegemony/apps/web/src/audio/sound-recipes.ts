import type { SoundCue } from './sound-cues.ts';

/** Ein Ton mit Gleitfrequenz und Hüllkurve; Zeiten in Sekunden ab Start des Klangs. */
export interface ToneStep {
  readonly kind: 'tone';
  readonly wave: OscillatorType;
  readonly from: number;
  readonly to: number;
  readonly at: number;
  readonly length: number;
  readonly gain: number;
}

/** Gefiltertes Rauschen, z. B. für Würfel, Triebwerke und Explosionen. */
export interface NoiseStep {
  readonly kind: 'noise';
  readonly filter: number;
  readonly at: number;
  readonly length: number;
  readonly gain: number;
}

export type SoundStep = ToneStep | NoiseStep;

const tone = (
  wave: OscillatorType,
  from: number,
  to: number,
  at: number,
  length: number,
  gain = 0.3,
): ToneStep => ({ kind: 'tone', wave, from, to, at, length, gain });

const noise = (filter: number, at: number, length: number, gain = 0.3): NoiseStep => ({
  kind: 'noise',
  filter,
  at,
  length,
  gain,
});

/** Eine Folge von Tönen gleicher Länge, z. B. ein Akkord als Arpeggio. */
const arpeggio = (wave: OscillatorType, notes: readonly number[], step: number, gain = 0.25) =>
  notes.map((note, index) => tone(wave, note, note, index * step, step * 2, gain));

/**
 * Eigene, im Browser erzeugte Klänge: keine Aufnahmen, keine fremden Dateien.
 * Neue Klänge sind neue Einträge (Open/Closed), der Synthesizer bleibt gleich.
 */
export const RECIPES: Readonly<Record<SoundCue, readonly SoundStep[]>> = {
  activate: [tone('sine', 660, 990, 0, 0.18, 0.25), tone('sine', 990, 990, 0.12, 0.25, 0.15)],
  move: [noise(900, 0, 0.6, 0.2), tone('sawtooth', 80, 160, 0, 0.6, 0.06)],
  dice: [
    noise(3200, 0, 0.05),
    noise(2800, 0.07, 0.05),
    noise(3000, 0.15, 0.05),
    noise(2600, 0.24, 0.06),
  ],
  explosion: [noise(400, 0, 0.7, 0.45), tone('sine', 120, 40, 0, 0.6, 0.35)],
  capture: arpeggio('triangle', [392, 523, 659, 784], 0.09),
  produce: [tone('square', 220, 330, 0, 0.12, 0.1), tone('square', 330, 440, 0.12, 0.14, 0.1)],
  card: [noise(5000, 0, 0.08, 0.15), tone('sine', 880, 1320, 0.02, 0.1, 0.1)],
  research: arpeggio('sine', [523, 659, 784, 1047], 0.07, 0.2),
  score: arpeggio('triangle', [523, 784, 1047], 0.1),
  vote: [tone('sine', 440, 440, 0, 0.15, 0.2), tone('sine', 554, 554, 0.1, 0.2, 0.15)],
  phase: [tone('sine', 330, 330, 0, 0.5, 0.15), tone('sine', 495, 495, 0.05, 0.5, 0.1)],
  yourTurn: [
    tone('triangle', 784, 784, 0, 0.15, 0.25),
    tone('triangle', 1047, 1047, 0.15, 0.3, 0.25),
  ],
  victory: arpeggio('triangle', [392, 523, 659, 784, 1047, 1319], 0.12, 0.3),
};
