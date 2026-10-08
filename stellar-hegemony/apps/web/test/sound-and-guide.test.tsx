// @vitest-environment jsdom
import type { GameState } from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectLayer } from '../src/animation/effect-layer.ts';
import { App } from '../src/App.tsx';
import type { SoundCue } from '../src/audio/sound-cues.ts';
import { SynthSound } from '../src/audio/synth-sound.ts';
import { setSoundPort } from '../src/audio/use-sound-effects.ts';
import { TurnPanel } from '../src/components/game/TurnPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { TUTORIAL_STEPS } from '../src/tutorial/tutorial-steps.ts';
import { useTutorialStore } from '../src/tutorial/tutorial-store.ts';
import { currentActor } from '../src/local-game.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { keepSecrets, pickAll, started } from './game-helpers.ts';

installDomPolyfills();

/** Attrappe des Audiokontexts: zählt erzeugte Knoten statt Ton auszugeben. */
function fakeAudio(state: AudioContextState = 'suspended') {
  const made: string[] = [];
  const param = () => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const node = (kind: string) => {
    made.push(kind);
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      gain: param(),
      frequency: param(),
      type: '',
      buffer: null,
    };
  };
  const resume = vi.fn(() => Promise.resolve());
  const context = {
    state,
    currentTime: 0,
    sampleRate: 100,
    destination: {},
    resume,
    createGain: () => node('gain'),
    createOscillator: () => node('oscillator'),
    createBiquadFilter: () => node('filter'),
    createBufferSource: () => node('noise'),
    createBuffer: (_channels: number, length: number) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
  };
  return { made, resume, context: context as unknown as AudioContext };
}

/** Der Spieler am Zug wählt die erste freie Strategiekarte. */
function pickNext(): void {
  const game = useGameStore.getState().game as GameState;
  const card = Object.values(game.strategyCards).find((option) => option.holder === null);
  const actor = currentActor(game);
  if (card === undefined || actor === null) throw new Error('keine Wahl');
  useGameStore.getState().send({ type: 'PickStrategyCard', issuedBy: actor, card: card.id });
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  useGalaxyStore.setState({ language: 'de' });
  useGameStore.getState().leave();
  useSettingsStore.setState({ sound: true, volume: 0.6, animations: true, tips: true });
  useTutorialStore.setState({ open: false, step: 0 });
});

afterEach(() => {
  cleanup();
  setSoundPort(null);
  vi.useRealTimers();
});

describe('Eigene Klänge', () => {
  it('der Synthesizer baut jeden Klang aus Tönen und Rauschen, erst beim ersten Abspielen', () => {
    const audio = fakeAudio();
    const create = vi.fn(() => audio.context);
    const synth = new SynthSound(create);
    expect(create).not.toHaveBeenCalled();
    synth.play('explosion', 0.5);
    synth.play('yourTurn', 0.5);
    expect(create).toHaveBeenCalledTimes(1);
    expect(audio.resume).toHaveBeenCalled();
    expect(audio.made).toContain('noise');
    expect(audio.made).toContain('oscillator');
  });

  it('stumm bei Lautstärke null oder ohne Web Audio', () => {
    const audio = fakeAudio('running');
    new SynthSound(() => audio.context).play('dice', 0);
    expect(audio.made).toEqual([]);
    const broken = new SynthSound(() => {
      throw new Error('kein Audio');
    });
    expect(() => broken.play('dice', 1)).not.toThrow();
  });

  it('jeder Zug klingt, solange Klang eingeschaltet ist', () => {
    vi.useFakeTimers();
    const played: SoundCue[] = [];
    setSoundPort({ play: (cue) => played.push(cue) });
    render(<App />);
    act(() => void keepSecrets(started()));
    act(() => pickNext());
    act(() => {
      vi.runAllTimers();
    });
    expect(played).toContain('card');
    played.length = 0;
    act(() => useSettingsStore.getState().toggle('sound'));
    act(() => pickNext());
    act(() => {
      vi.runAllTimers();
    });
    expect(played).toEqual([]);
  });
});

describe('Einstellungen', () => {
  it('bleiben im Browser gespeichert; die Lautstärke bleibt zwischen 0 und 1', () => {
    const settings = useSettingsStore.getState();
    settings.toggle('animations');
    settings.setVolume(3);
    expect(JSON.parse(localStorage.getItem('stellar.settings') ?? '{}')).toEqual({
      sound: true,
      volume: 1,
      animations: false,
      tips: true,
    });
  });

  it('ohne Animationen schaltet die Oberfläche alle Bewegungen ab', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    const toggle = () => fireEvent.click(screen.getByRole('switch', { name: 'Animationen' }));
    toggle();
    expect(document.documentElement.classList.contains('motion-off')).toBe(true);
    toggle();
    expect(document.documentElement.classList.contains('motion-off')).toBe(false);
  });

  it('Effekte auf der Karte enden nach ihrer Dauer', () => {
    const layer = new EffectLayer();
    layer.play([
      {
        kind: 'travel',
        path: [
          { q: 0, r: 0 },
          { q: 1, r: 0 },
        ],
        seat: 1,
      },
      { kind: 'blast', at: { q: 0, r: 0 } },
    ]);
    expect(layer.active).toBe(true);
    expect(layer.update(500)).toBe(true);
    expect(layer.update(500)).toBe(false);
    expect(layer.container.children.length).toBe(0);
  });
});

describe('Anleitung und Tipps', () => {
  it('führt Schritt für Schritt und hebt das passende Bedienelement hervor', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Anleitung' }));
    const dialog = () => screen.getByRole('dialog', { name: 'Anleitung' });
    expect(dialog().textContent).toContain(`1 / ${String(TUTORIAL_STEPS.length)}`);
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(dialog().textContent).toContain('Die Galaxie');
    expect(document.querySelector('[data-tutorial="galaxy"]')?.classList).toContain(
      'tutorial-focus',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(document.querySelector('.tutorial-focus')).toBeNull();
    act(() => useTutorialStore.setState({ step: TUTORIAL_STEPS.length - 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('das Zugfeld zeigt einen Tipp zur Phase, solange Tipps an sind', () => {
    const game = pickAll(started());
    const { rerender } = render(<TurnPanel game={game} />);
    expect(screen.getByText(/Wähle ein System auf der Karte/)).toBeTruthy();
    act(() => useSettingsStore.getState().toggle('tips'));
    rerender(<TurnPanel game={game} />);
    expect(screen.queryByText(/Wähle ein System auf der Karte/)).toBeNull();
  });
});
