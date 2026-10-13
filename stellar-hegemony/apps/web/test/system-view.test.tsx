// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '@stellar/domain';
import { App } from '../src/App.tsx';
import { useSidebarStore } from '../src/components/game/sidebar-store.ts';
import { useGameStore } from '../src/game-store.ts';
import { currentActor } from '@stellar/domain';
import { useSettingsStore } from '../src/settings-store.ts';
import { DEFAULT_VIEWPORT, useGalaxyStore } from '../src/store.ts';
import { useCameraStore } from '../src/system/camera-store.ts';
import { FOCUS_ZOOM, ZOOM_MAX } from '../src/system/viewport-tween.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { keepSecrets, pickAll, started } from './game-helpers.ts';

installDomPolyfills();

const homeOfFirstSeat = () => {
  const polygon = document.querySelector('[data-seat="1"][data-system]');
  if (polygon === null) throw new Error('kein Heimatsystem');
  return polygon;
};

const systemView = () => screen.queryByRole('region', { name: 'Systemansicht' });
const zoom = () => useGalaxyStore.getState().viewport.zoom;

beforeEach(() => {
  localStorage.clear();
  useGalaxyStore.setState({ language: 'de', viewport: DEFAULT_VIEWPORT });
  useSettingsStore.setState({ animations: false });
  useCameraStore.setState({ returnTo: null });
  useGameStore.getState().leave();
});

afterEach(() => cleanup());

function viewHome() {
  render(<App />);
  act(() => void keepSecrets(started()));
  fireEvent.click(homeOfFirstSeat());
  expect(zoom()).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'System ansehen' }));
}

describe('Nahzoom auf der Karte statt Systemansicht', () => {
  it('ein Klick wählt das System, „Ansehen“ fährt auf der Karte heran, ohne eigene Ansicht', () => {
    viewHome();
    expect(zoom()).toBe(FOCUS_ZOOM);
    expect(systemView()).toBeNull();
    expect(useGameStore.getState().selected).toBe(homeOfFirstSeat().getAttribute('data-system'));
    expect(screen.getByRole('button', { name: 'System ansehen' })).toBeTruthy();
  });

  it('Escape fährt die Kamera an die alte Stelle zurück', () => {
    viewHome();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useGalaxyStore.getState().viewport).toEqual(DEFAULT_VIEWPORT);
    expect(useCameraStore.getState().returnTo).toBeNull();
  });

  it('ein zweiter Klick auf das gewählte System fährt ebenfalls heran', () => {
    render(<App />);
    act(() => void keepSecrets(started()));
    fireEvent.click(homeOfFirstSeat());
    fireEvent.click(homeOfFirstSeat());
    expect(zoom()).toBe(FOCUS_ZOOM);
  });

  it('RR 89: über dem gewählten System erscheint „System aktivieren“, wenn der Zug es erlaubt', () => {
    render(<App />);
    act(() => void pickAll(started()));
    const game = useGameStore.getState().game as GameState;
    const actor = currentActor(game);
    const home = Object.values(game.systems).find((system) =>
      system.spaceUnits.some((unit) => unit.owner === actor),
    );
    act(() => useGameStore.getState().select(home?.id ?? null));
    fireEvent.click(screen.getByRole('button', { name: 'System aktivieren' }));
    expect(useGameStore.getState().game?.actionPhase?.tactical?.system).toBe(home?.id);
    expect(screen.queryByRole('button', { name: 'System aktivieren' })).toBeNull();
  });

  it('tiefes Hineinzoomen vergrößert nur die Karte, bis an die Planeten, und öffnet nichts', () => {
    render(<App />);
    const zoomIn = screen.getByRole('button', { name: 'Hineinzoomen' });
    for (let step = 0; step < 30; step += 1) fireEvent.click(zoomIn);
    expect(zoom()).toBe(ZOOM_MAX);
    expect(systemView()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ansicht zurücksetzen' }));
    expect(useGalaxyStore.getState().viewport).toEqual(DEFAULT_VIEWPORT);
  });
});

describe('Übersicht als Schublade', () => {
  it('drei Reiter am Rand; ein Reiter öffnet die Schublade, ein zweites Antippen schließt sie', () => {
    useSidebarStore.setState({ tab: 'turn', open: false });
    render(<App />);
    act(() => void keepSecrets(started()));
    const drawer = () => document.querySelector('.game-drawer');
    const panel = (name: string) =>
      screen.getByText(name, { selector: '.panel-label' }).closest('.tab-panel');
    expect(drawer()?.classList.contains('open')).toBe(false);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Wertung' }));
    expect(drawer()?.classList.contains('open')).toBe(true);
    expect(panel('Aufträge und Siegpunkte')?.getAttribute('data-state')).toBe('active');
    expect(panel('Strategiekarten')?.getAttribute('data-state')).toBe('inactive');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Wertung' }));
    expect(drawer()?.classList.contains('open')).toBe(false);
  });

  it('die Anleitung öffnet den Reiter, in dem ihr Element liegt', () => {
    useSidebarStore.setState({ tab: 'turn', open: false });
    useSidebarStore.getState().reveal('players');
    expect(useSidebarStore.getState()).toMatchObject({ tab: 'score', open: true });
    useSidebarStore.getState().reveal('galaxy');
    expect(useSidebarStore.getState().tab).toBe('score');
  });

  it('Abschnitte lassen sich einklappen; der Inhalt bleibt erhalten', () => {
    render(<App />);
    act(() => void keepSecrets(started()));
    const trigger = screen.getByRole('button', { name: 'Strategiekarten' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const tile = screen.getByText('Führung', { selector: '.strategy-tile .card-name' });
    expect(tile.closest('[data-state="closed"]')).not.toBeNull();
  });

  it('das Einstellungsmenü schaltet Klang und Tipps', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Klang' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Tipps' }));
    const { sound, tips } = useSettingsStore.getState();
    expect([sound, tips]).toEqual([false, true]);
    expect(screen.getByRole('slider', { name: 'Lautstärke' })).toBeTruthy();
  });
});
