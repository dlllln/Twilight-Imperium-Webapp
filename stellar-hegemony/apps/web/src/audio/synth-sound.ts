import type { SoundCue } from './sound-cues.ts';
import { type NoiseStep, RECIPES, type SoundStep, type ToneStep } from './sound-recipes.ts';

/** Port für Klänge: die Oberfläche kennt nur `play`, Tests setzen eine Attrappe ein. */
export interface SoundPort {
  play(cue: SoundCue, volume: number): void;
}

const SILENT = 0.0001;

function envelope(context: AudioContext, step: SoundStep, start: number, volume: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(SILENT, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(SILENT, step.gain * volume), start + 0.01);
  gain.gain.exponentialRampToValueAtTime(SILENT, start + step.length);
  gain.connect(context.destination);
  return gain;
}

function playTone(context: AudioContext, step: ToneStep, start: number, volume: number): void {
  const oscillator = context.createOscillator();
  oscillator.type = step.wave;
  oscillator.frequency.setValueAtTime(step.from, start);
  oscillator.frequency.exponentialRampToValueAtTime(step.to, start + step.length);
  oscillator.connect(envelope(context, step, start, volume));
  oscillator.start(start);
  oscillator.stop(start + step.length);
}

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * seconds),
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}

function playNoise(context: AudioContext, step: NoiseStep, start: number, volume: number): void {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, step.length);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(step.filter, start);
  source.connect(filter);
  filter.connect(envelope(context, step, start, volume));
  source.start(start);
}

/**
 * Synthesizer mit der Web Audio API (Interpreter für `RECIPES`). Der Audiokontext
 * entsteht erst beim ersten Klang, weil Browser Ton erst nach einer Nutzeraktion erlauben.
 */
export class SynthSound implements SoundPort {
  private context: AudioContext | null = null;

  constructor(private readonly createContext: () => AudioContext = () => new AudioContext()) {}

  play(cue: SoundCue, volume: number): void {
    const context = this.ensureContext();
    if (context === null || volume <= 0) return;
    const start = context.currentTime + 0.02;
    for (const step of RECIPES[cue]) {
      if (step.kind === 'tone') playTone(context, step, start + step.at, volume);
      else playNoise(context, step, start + step.at, volume);
    }
  }

  private ensureContext(): AudioContext | null {
    try {
      this.context ??= this.createContext();
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    } catch {
      return null;
    }
  }
}
