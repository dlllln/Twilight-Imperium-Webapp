// @vitest-environment jsdom
import { playerId, unitId, unitTypeId, type Volley } from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiceTray } from '../src/components/combat/DiceTray.tsx';
import { DICE_REVEAL_MS } from '../src/components/combat/use-dice-reveal.ts';
import { BattleScreen } from '../src/components/simulator/BattleScreen.tsx';
import { useSettingsStore } from '../src/settings-store.ts';
import { useSimulatorStore } from '../src/simulator/simulator-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { installDomPolyfills } from './dom-polyfills.ts';

installDomPolyfills();

const volley: Volley = {
  player: playerId('one'),
  target: playerId('two'),
  hits: 2,
  rolls: [
    { unit: unitId('cruiser'), type: unitTypeId('cruiser'), hitOn: 8, results: [2, 9] },
    { unit: unitId('dreadnought'), type: unitTypeId('dreadnought'), hitOn: 5, results: [10] },
  ],
};

const values = () =>
  [...document.querySelectorAll('.tabletop-die-face')].map((die) => die.textContent);
const rolling = () => document.querySelector('.dice-tray')?.getAttribute('data-rolling');

beforeEach(() => {
  vi.useFakeTimers();
  useSettingsStore.setState({ animations: true, sound: false });
  useGalaxyStore.setState({ language: 'de' });
});

afterEach(() => {
  cleanup();
  useSimulatorStore.getState().close();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Greifbare Würfelschale', () => {
  it('zeigt unveränderte Einzelwürfe mit Treffergrenze und verständlichen Treffern und Fehlschlägen', () => {
    useSettingsStore.setState({ animations: false });
    render(<DiceTray volley={volley} />);
    expect(values()).toEqual(['2', '9', '10']);
    expect(screen.getByRole('img', { name: /Kreuzer: 2.*8.*Fehlschlag/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Kreuzer: 9.*8.*Treffer/ })).toBeTruthy();
    expect(document.querySelectorAll('.tabletop-die.hit')).toHaveLength(2);
    expect(screen.getByText('2 Treffer')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lässt die Darstellung sofort beenden, ohne neu zu würfeln oder Spielwerte zu verändern', () => {
    const unchanged = JSON.stringify(volley);
    render(<DiceTray volley={volley} />);
    expect(rolling()).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Ergebnis zeigen' }));
    expect(rolling()).toBe('false');
    expect(values()).toEqual(['2', '9', '10']);
    expect(JSON.stringify(volley)).toBe(unchanged);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('endet von selbst und räumt bei einem neuen Wurf den vorherigen Timer auf', () => {
    const view = render(<DiceTray volley={volley} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    view.rerender(<DiceTray volley={{ ...volley, hits: 1, rolls: volley.rolls.slice(0, 1) }} />);
    act(() => {
      vi.advanceTimersByTime(DICE_REVEAL_MS - 500);
    });
    expect(rolling()).toBe('true');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(rolling()).toBe('false');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('beendet laufende Würfel sofort, wenn Animationen ausgeschaltet werden', () => {
    render(<DiceTray volley={volley} />);
    act(() => useSettingsStore.setState({ animations: false }));
    expect(rolling()).toBe('false');
    expect(values()).toEqual(['2', '9', '10']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('respektiert weniger Bewegung des Betriebssystems auch bei eingeschalteten Animationen', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(<DiceTray volley={volley} />);
    expect(rolling()).toBe('false');
    expect(screen.queryByRole('button')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('startet ohne Würfel keine leere Animation', () => {
    render(<DiceTray volley={{ ...volley, rolls: [], hits: 0 }} />);
    expect(rolling()).toBe('false');
    expect(screen.getByText('0 Treffer')).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Simulatorwürfe', () => {
  it('zeigt exakt die Einzelwürfe aus dem tatsächlichen Rundenbericht beider Seiten', () => {
    useSettingsStore.setState({ animations: false });
    const sim = useSimulatorStore.getState();
    sim.open();
    sim.confirmFaction();
    sim.setCount(unitTypeId('dreadnought'), 2);
    sim.launch();
    sim.fire();
    const report = useSimulatorStore.getState().report;
    expect(report).not.toBeNull();
    const expected = [
      ...(report?.barrage.map((entry) => entry.volley) ?? []),
      ...(report?.volleys ?? []),
    ].flatMap((entry) => entry.rolls.flatMap((roll) => roll.results.map(String)));
    render(<BattleScreen />);
    expect(values()).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });

  it('beendet einen laufenden Simulatorwurf und entfernt dessen verzögertes Aufdecken', () => {
    const sim = useSimulatorStore.getState();
    sim.open();
    sim.confirmFaction();
    sim.setCount(unitTypeId('dreadnought'), 2);
    sim.launch();
    render(<BattleScreen />);
    act(() => sim.fire());
    expect(useSimulatorStore.getState().shown).not.toBe(useSimulatorStore.getState().battle);
    fireEvent.click(screen.getByRole('button', { name: 'Kampfanimation beenden' }));
    expect(useSimulatorStore.getState().shown).toBe(useSimulatorStore.getState().battle);
    expect(screen.queryByRole('button', { name: 'Kampfanimation beenden' })).toBeNull();
  });

  it('lässt nach dem Überspringen keinen alten Rundentimer zurück', () => {
    const sim = useSimulatorStore.getState();
    sim.open();
    sim.confirmFaction();
    sim.setCount(unitTypeId('dreadnought'), 2);
    sim.launch();
    sim.fire();
    expect(vi.getTimerCount()).toBe(1);
    sim.settle();
    expect(vi.getTimerCount()).toBe(0);
  });
});
