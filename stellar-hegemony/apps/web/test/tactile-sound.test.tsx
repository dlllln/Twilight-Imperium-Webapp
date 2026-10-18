// @vitest-environment jsdom
import type { GameEvent } from '@stellar/domain';
import { unitTypeId } from '@stellar/domain';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { soundCues, type SoundCue } from '../src/audio/sound-cues.ts';
import { SynthSound } from '../src/audio/synth-sound.ts';
import { setSoundPort, useSoundEffects } from '../src/audio/use-sound-effects.ts';
import { useGameStore } from '../src/game-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useSimulatorStore } from '../src/simulator/simulator-store.ts';
import { started } from './game-helpers.ts';

function SoundHarness() {
  useSoundEffects();
  return null;
}
const events = (types: readonly GameEvent['type'][]) =>
  types.map((type) => ({ type })) as GameEvent[];

beforeEach(() => {
  vi.useFakeTimers();
  useGameStore.getState().leave();
  useSimulatorStore.getState().close();
  useSettingsStore.setState({ sound: true, volume: 0.6 });
});

afterEach(() => {
  cleanup();
  setSoundPort(null);
  vi.useRealTimers();
});

describe('Klänge von Spielmaterial', () => {
  it('ordnet echten Karten-, Marker-, Waren- und Verteidigungswürfen die passenden Klänge zu', () => {
    expect(
      soundCues(
        events([
          'ActionCardsDrawn',
          'PlanetsExhausted',
          'CommandTokensPlaced',
          'TradeGoodsSpent',
          'SpaceCannonDefenseFired',
        ]),
      ),
    ).toEqual(['card', 'token', 'resource', 'dice']);
    expect(
      soundCues(events(['CommandTokensRedistributed', 'CommandTokenReturned', 'TradeGoodsGained'])),
    ).toEqual(['token', 'resource']);
  });

  it('öffnet bei stummem oder ungültigem Pegel keinen Audiokontext', () => {
    const create = vi.fn<() => AudioContext>();
    const synth = new SynthSound(create);
    synth.play('resource', 0);
    synth.play('token', Number.NaN);
    expect(create).not.toHaveBeenCalled();
  });

  it('unterdrückt bereits eingeplante Klänge nach Stummschalten und nimmt aktuelle Lautstärke', () => {
    const played: { cue: SoundCue; volume: number }[] = [];
    setSoundPort({ play: (cue, volume) => played.push({ cue, volume }) });
    const game = started();
    useGameStore.setState({ game, lastEvents: null });
    render(<SoundHarness />);
    act(() =>
      useGameStore.setState({
        lastEvents: {
          serial: 1,
          before: game,
          events: events(['SystemActivated', 'ActionCardPlayed', 'TradeGoodsSpent']),
        },
      }),
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(played).toEqual([{ cue: 'activate', volume: 0.6 }]);
    act(() => useSettingsStore.setState({ volume: 0.2 }));
    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(played[1]).toEqual({ cue: 'card', volume: 0.2 });
    act(() => useSettingsStore.setState({ sound: false }));
    act(() => {
      vi.runAllTimers();
    });
    expect(played).toHaveLength(2);
  });

  it('begleitet einen wirklichen Simulatorwurf einmal mit Würfelklang', () => {
    const played: SoundCue[] = [];
    setSoundPort({ play: (cue) => played.push(cue) });
    useSettingsStore.setState({ animations: false });
    const sim = useSimulatorStore.getState();
    sim.open();
    sim.confirmFaction();
    sim.setCount(unitTypeId('dreadnought'), 2);
    sim.launch();
    render(<SoundHarness />);
    act(() => sim.fire());
    act(() => {
      vi.runAllTimers();
    });
    expect(played.filter((cue) => cue === 'dice')).toHaveLength(1);
  });
});
