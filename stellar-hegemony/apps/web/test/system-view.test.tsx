// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '@stellar/domain';
import { App } from '../src/App.tsx';
import { useSidebarStore } from '../src/components/game/sidebar-store.ts';
import { useGameStore } from '../src/game-store.ts';
import { currentActor } from '../src/local-game.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { DEFAULT_VIEWPORT, useGalaxyStore } from '../src/store.ts';
import { useSystemViewStore } from '../src/system/system-view-store.ts';
import { FOCUS_ZOOM } from '../src/system/viewport-tween.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { keepSecrets, pickAll, started } from './game-helpers.ts';

installDomPolyfills();

const homeOfFirstSeat = () => {
  const polygon = document.querySelector('[data-seat="1"][data-system]');
  if (polygon === null) throw new Error('kein Heimatsystem');
  return polygon;
};

const systemView = () => screen.queryByRole('region', { name: 'Systemansicht' });

beforeEach(() => {
  localStorage.clear();
  useGalaxyStore.setState({ language: 'de', viewport: DEFAULT_VIEWPORT });
  useSettingsStore.setState({ animations: false });
  useSystemViewStore.setState({ key: null, returnTo: null });
  useGameStore.getState().leave();
});

afterEach(() => cleanup());

function openHome() {
  render(<App />);
  act(() => void keepSecrets(started()));
  fireEvent.click(homeOfFirstSeat());
  expect(systemView()).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'System ansehen' }));
  const view = systemView();
  if (view === null) throw new Error('Systemansicht fehlt');
  return view;
}

describe('Systemansicht', () => {
  it('ein Klick wählt das System, „Ansehen“ fährt ohne Fenster hinein und zeigt Flotten und Planeten', () => {
    const view = openHome();
    expect(useGalaxyStore.getState().viewport.zoom).toBe(FOCUS_ZOOM);
    expect(useGameStore.getState().selected).toBe(homeOfFirstSeat().getAttribute('data-system'));
    const contents = within(view).getByRole('list', { name: 'Im System' });
    expect(contents.textContent).toContain('Träger');
    expect(contents.textContent).toContain('Raumdock');
    expect(contents.textContent).toContain('Infanterie');
    expect(within(view).getByText(/Heimatsystem/)).toBeTruthy();
  });

  it('Escape schließt und fährt die Kamera an die alte Stelle zurück', async () => {
    openHome();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(systemView()).toBeNull());
    expect(useGalaxyStore.getState().viewport).toEqual(DEFAULT_VIEWPORT);
  });

  it('Herauszoomen mit dem Mausrad kehrt zur Sternenkarte zurück', async () => {
    const view = openHome();
    fireEvent.wheel(view, { deltaY: -120 });
    expect(systemView()).not.toBeNull();
    fireEvent.wheel(view, { deltaY: 120 });
    await waitFor(() => expect(systemView()).toBeNull());
  });

  it('ein zweiter Klick auf das gewählte System fährt ebenfalls hinein', () => {
    render(<App />);
    act(() => void keepSecrets(started()));
    fireEvent.click(homeOfFirstSeat());
    fireEvent.click(homeOfFirstSeat());
    expect(systemView()).not.toBeNull();
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

  it('tiefes Hineinzoomen öffnet das System in der Bildmitte von selbst', () => {
    render(<App />);
    const zoomIn = screen.getByRole('button', { name: 'Hineinzoomen' });
    for (let step = 0; step < 4; step += 1) fireEvent.click(zoomIn);
    expect(systemView()).toBeNull();
    fireEvent.click(zoomIn);
    expect(systemView()).not.toBeNull();
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
