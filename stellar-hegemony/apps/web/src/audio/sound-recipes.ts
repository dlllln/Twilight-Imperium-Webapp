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
  activate: [noise(1550, 0, 0.035, 0.15), tone('triangle', 230, 100, 0.008, 0.07, 0.12)],
  move: [noise(900, 0, 0.6, 0.2), tone('sawtooth', 80, 160, 0, 0.6, 0.06)],
  dice: [
    noise(2600, 0, 0.045, 0.17),
    tone('triangle', 290, 130, 0.01, 0.055, 0.08),
    noise(2200, 0.08, 0.035, 0.15),
    noise(1850, 0.17, 0.03, 0.13),
    tone('triangle', 245, 120, 0.18, 0.045, 0.07),
    noise(1500, 0.3, 0.025, 0.1),
    noise(1300, 0.43, 0.018, 0.07),
  ],
  explosion: [noise(400, 0, 0.7, 0.45), tone('sine', 120, 40, 0, 0.6, 0.35)],
  capture: arpeggio('triangle', [392, 523, 659, 784], 0.09),
  produce: [noise(1800, 0, 0.025, 0.13), tone('triangle', 330, 140, 0.01, 0.08, 0.1)],
  token: [noise(1450, 0, 0.025, 0.12), tone('triangle', 260, 130, 0.01, 0.06, 0.1)],
  resource: [
    noise(2200, 0, 0.02, 0.11),
    tone('sine', 530, 370, 0.01, 0.055, 0.09),
    noise(1700, 0.07, 0.018, 0.08),
  ],
  card: [noise(4200, 0, 0.09, 0.11), noise(2400, 0.075, 0.04, 0.08)],
  research: arpeggio('sine', [523, 659, 784, 1047], 0.07, 0.2),
  score: arpeggio('triangle', [523, 784, 1047], 0.1),
  vote: [tone('sine', 440, 440, 0, 0.15, 0.2), tone('sine', 554, 554, 0.1, 0.2, 0.15)],
  phase: [tone('sine', 330, 330, 0, 0.5, 0.15), tone('sine', 495, 495, 0.05, 0.5, 0.1)],
  yourTurn: [
    tone('triangle', 784, 784, 0, 0.15, 0.25),
    tone('triangle', 1047, 1047, 0.15, 0.3, 0.25),
  ],
  victory: arpeggio('triangle', [392, 523, 659, 784, 1047, 1319], 0.12, 0.3),
  /* Tischklänge: kurz und leise, damit sie Gesten begleiten statt sie zu übertönen. */
  // Karte kippt quer: ein tiefes Schaben über den Filz.
  exhaust: [noise(1100, 0, 0.12, 0.1), tone('triangle', 180, 120, 0.02, 0.1, 0.05)],
  // Karte richtet sich auf: dasselbe Schaben, aufwärts.
  ready: [noise(1700, 0, 0.1, 0.09), tone('triangle', 150, 230, 0.02, 0.09, 0.05)],
  // Münze auf Münze: zwei helle, kurze Glockentöne.
  coin: [tone('sine', 1760, 1700, 0, 0.09, 0.08), tone('sine', 2490, 2400, 0.045, 0.1, 0.05)],
  // Karte vom Stapel: kurzes Wischen mit leiser werdendem Nachklang.
  draw: [noise(5200, 0, 0.07, 0.08), noise(3000, 0.05, 0.08, 0.05)],
  // Karte umdrehen: Luftzug, dann ein weicher Anschlag.
  reveal: [noise(2600, 0, 0.14, 0.07), tone('sine', 392, 523, 0.1, 0.18, 0.07)],
  // Hammer auf Holz: dumpfer Schlag mit kurzem Holzklang.
  gavel: [
    noise(600, 0, 0.05, 0.2),
    tone('sine', 140, 90, 0, 0.18, 0.18),
    tone('triangle', 620, 540, 0.005, 0.06, 0.06),
  ],
};
