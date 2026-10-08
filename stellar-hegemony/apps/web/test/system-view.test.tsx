// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.tsx';
import { useSidebarStore } from '../src/components/game/sidebar-store.ts';
import { useGameStore } from '../src/game-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { DEFAULT_VIEWPORT, useGalaxyStore } from '../src/store.ts';
import { useSystemViewStore } from '../src/system/system-view-store.ts';
import { FOCUS_ZOOM } from '../src/system/viewport-tween.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { keepSecrets, started } from './game-helpers.ts';

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
  const view = systemView();
  if (view === null) throw new Error('Systemansicht fehlt');
  return view;
}

describe('Systemansicht', () => {
  it('ein Klick fährt ohne Fenster ins System, wählt es aus und zeigt Flotten und Planeten', () => {
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

  it('tiefes Hineinzoomen öffnet das System in der Bildmitte von selbst', () => {
    render(<App />);
    const zoomIn = screen.getByRole('button', { name: 'Hineinzoomen' });
    for (let step = 0; step < 4; step += 1) fireEvent.click(zoomIn);
    expect(systemView()).toBeNull();
    fireEvent.click(zoomIn);
    expect(systemView()).not.toBeNull();
  });
});

describe('Moderne Seitenleiste', () => {
  it('drei Reiter: Zug, Wertung, Reich; der Zug ist vorgewählt', () => {
    render(<App />);
    act(() => void keepSecrets(started()));
    const panel = (name: string) =>
      screen.getByText(name, { selector: '.panel-label' }).closest('.tab-panel');
    expect(panel('Strategiekarten')?.getAttribute('data-state')).toBe('active');
    expect(panel('Aufträge und Siegpunkte')?.getAttribute('data-state')).toBe('inactive');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Wertung' }));
    expect(panel('Aufträge und Siegpunkte')?.getAttribute('data-state')).toBe('active');
    expect(panel('Strategiekarten')?.getAttribute('data-state')).toBe('inactive');
  });

  it('die Anleitung öffnet den Reiter, in dem ihr Element liegt', () => {
    useSidebarStore.getState().setTab('turn');
    useSidebarStore.getState().reveal('players');
    expect(useSidebarStore.getState().tab).toBe('score');
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
