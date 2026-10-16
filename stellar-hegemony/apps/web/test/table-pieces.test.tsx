// @vitest-environment jsdom
import {
  currentActor,
  findPlayer,
  type GameState,
  type PlayerId,
  strategyCardId,
  updatePlayer,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerSheet } from '../src/components/sheet/PlayerSheet.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { useCameraStore } from '../src/system/camera-store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { activatableSystems } from '../src/table/legal-systems.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

installDomPolyfills();

const LEADERSHIP = strategyCardId('vanguard');

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false });
  const empty = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };
  useCarryStore.setState({ ...empty, news: null });
  useDraftStore.getState().clear();
  useHandStore.getState().clear();
});

afterEach(() => {
  cleanup();
  leaveTable();
  useHandStore.getState().clear();
  Reflect.deleteProperty(document, 'elementsFromPoint');
});

const game = () => useGameStore.getState().game as GameState;

/** Pult, das dem Spielstand folgt. */
function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  return current === null ? null : <PlayerSheet game={current} />;
}

/** Statusphase beim Verteilen der Marker; der erste Spieler sitzt am Bildschirm. */
function tokenStep(): PlayerId {
  const state = pickAll(started());
  const order = state.players.map((player) => player.id);
  const statusPhase = { step: 'tokens', order, waiting: order, scored: {} } as const;
  const me = order[0] as PlayerId;
  seatTable({ ...state, phase: 'status', actionPhase: null, statusPhase }, { me });
  return me;
}

/** Aktionsphase; der Spieler am Zug sitzt am Bildschirm. */
function actionPhase(): PlayerId {
  const state = pickAll(started());
  const me = currentActor(state) as PlayerId;
  seatTable(state, { me });
  return me;
}

const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
const piece = (pool: string) => button(`Marker aufnehmen: ${pool}`);
const tray = (label: string) => screen.getByLabelText(label);
const announced = () => document.querySelector('[aria-live="polite"]')?.textContent;
const tokenIds = (element: Element) =>
  [...element.querySelectorAll('.sheet-token')].map((chip) => chip.getAttribute('data-token'));

describe('Kommandomarker als Spielsteine am Pult', () => {
  it('während der Markerverteilung tragen die Leisten Taktik + und Taktik −', () => {
    tokenStep();
    render(<Live />);
    expect(screen.getByRole('group', { name: 'Neue Marker: 2' })).toBeTruthy();
    expect(button('Taktik −').disabled).toBe(false);
    fireEvent.click(button('Taktik +'));
    expect(tray('Taktik: 4')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Neue Marker: 1' })).toBeTruthy();
    fireEvent.click(button('Taktik −'));
    fireEvent.click(button('Taktik −'));
    expect(tray('Taktik: 2')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Neue Marker: 3' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Flotte [+−]$/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Strategie [+−]$/ })).toHaveLength(2);
  });

  it('Enter auf einem Marker nimmt ihn auf, ein Klick auf eine Leiste legt ihn ab', () => {
    tokenStep();
    render(<Live />);
    const loose = piece('Neue Marker');
    loose.focus();
    fireEvent.keyDown(loose, { key: 'Enter' });
    fireEvent.click(loose);
    expect(loose.getAttribute('aria-pressed')).toBe('true');
    expect(tray('Flotte: 3').getAttribute('data-target-state')).toBe('legal');
    expect(tray('Flotte: 3').getAttribute('data-target')).toBe('pool:fleet');
    fireEvent.click(tray('Flotte: 3'));
    expect(tray('Flotte: 4')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Neue Marker: 1' })).toBeTruthy();
    expect(useCarryStore.getState().piece).toBeNull();
    expect(tray('Strategie: 2').hasAttribute('tabindex')).toBe(false);
    fireEvent.click(piece('Neue Marker'));
    expect(tray('Strategie: 2').getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(tray('Strategie: 2'), { key: 'Enter' });
    expect(tray('Strategie: 3')).toBeTruthy();
    expect(useGameStore.getState().error).toBeNull();
  });

  it('Escape legt den Marker zurück, ohne die Kamera zurückzufahren', () => {
    actionPhase();
    const back = vi.fn();
    useCameraStore.setState({ returnTo: useGalaxyStore.getState().viewport, back });
    const camera = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && useCameraStore.getState().returnTo !== null)
        useCameraStore.getState().back();
    };
    window.addEventListener('keydown', camera);
    render(<Live />);
    fireEvent.click(piece('Taktik'));
    expect(useCarryStore.getState().piece).not.toBeNull();
    fireEvent.keyDown(piece('Taktik'), { key: 'Escape' });
    expect(useCarryStore.getState().piece).toBeNull();
    expect(piece('Taktik').getAttribute('aria-pressed')).toBe('false');
    expect(back).not.toHaveBeenCalled();
    fireEvent.keyDown(piece('Taktik'), { key: 'Escape' });
    expect(back).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', camera);
    useCameraStore.setState({ returnTo: null });
  });

  it('Führung: drei neue Marker liegen in der Schale und wandern per Taktik + auf die Leiste', () => {
    const me = actionPhase();
    render(<Live />);
    act(() => useHandStore.getState().choose({ player: me, card: LEADERSHIP }));
    const bowl = screen.getByRole('group', { name: 'Neue Marker: 3' });
    const gained = tokenIds(bowl);
    expect(gained).toHaveLength(3);
    expect(bowl.querySelectorAll('.sheet-token[data-zone="loose"]')).toHaveLength(3);
    expect(tray('Nachschub: 5')).toBeTruthy();
    expect(button('Flotte −').disabled).toBe(true);
    for (let step = 0; step < 3; step += 1) fireEvent.click(button('Taktik +'));
    expect(screen.getByRole('group', { name: 'Neue Marker: 0' })).toBeTruthy();
    expect(tokenIds(tray('Taktik: 6'))).toEqual(expect.arrayContaining(gained));
    expect(button('Taktik +').disabled).toBe(true);
    expect(findPlayer(game(), me)?.commandPools.tactic).toBe(3);
  });

  it('außerhalb einer Verteilung trägt nur die Taktikleiste einen Marker zum Aufnehmen, und nur wenn ein System aktivierbar ist', () => {
    const me = actionPhase();
    const original = game();
    const view = render(<Live />);
    const sheet = screen.getByRole('region', { name: 'Dein Kommandopult' });
    const pieces = sheet.querySelectorAll('.sheet-piece');
    expect([...pieces].map((element) => element.getAttribute('data-piece'))).toEqual([
      'pool:tactic',
    ]);
    expect(sheet.querySelector('.rail-controls, .sheet-loose')).toBeNull();
    const drained = updatePlayer(game(), me, (player) => ({
      ...player,
      commandPools: { ...player.commandPools, tactic: 0 },
    }));
    act(() => useGameStore.setState({ game: drained }));
    expect(activatableSystems(drained, me)).toHaveLength(0);
    expect(sheet.querySelector('.sheet-piece')).toBeNull();
    const other = original.players.find((player) => player.id !== me)?.id ?? null;
    act(() => useGameStore.setState({ game: original, me: other }));
    expect(view.container.querySelector('.sheet-tray')).not.toBeNull();
    expect(view.container.querySelector('.sheet-piece')).toBeNull();
  });

  it('der Ansager nennt Aufnehmen und Ablegen', () => {
    tokenStep();
    render(<Live />);
    expect(announced()).toBe('');
    fireEvent.click(piece('Neue Marker'));
    expect(announced()).toBe('Aufgenommen: Neue Marker. Wähle ein Ziel, Escape legt zurück.');
    fireEvent.click(tray('Strategie: 2'));
    expect(announced()).toBe('Abgelegt: Strategie.');
    fireEvent.click(piece('Neue Marker'));
    fireEvent.keyDown(piece('Neue Marker'), { key: 'Escape' });
    expect(announced()).toBe('Zurückgelegt.');
  });

  it('ein auf ein erlaubtes System gezogener Taktikmarker sendet ActivateSystem; der Geist folgt dem Zeiger', () => {
    const me = actionPhase();
    const system = activatableSystems(game(), me)[0];
    const hex = document.createElement('div');
    hex.setAttribute('data-target', `system:${String(system)}`);
    Object.defineProperty(document, 'elementsFromPoint', {
      value: () => [hex],
      configurable: true,
    });
    render(<Live />);
    const tactic = piece('Taktik');
    fireEvent.pointerDown(tactic, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(tactic, { pointerId: 1, clientX: 30, clientY: 12 });
    const ghost = document.body.querySelector<HTMLElement>('body > .drag-ghost');
    expect(ghost?.style.getPropertyValue('--x')).toBe('30px');
    expect(tray('Taktik: 3').querySelectorAll('[data-dragging="true"]')).toHaveLength(1);
    fireEvent.pointerUp(tactic, { pointerId: 1, clientX: 30, clientY: 12 });
    expect(game().actionPhase?.tactical?.system).toBe(system);
    expect(tray('Taktik: 2')).toBeTruthy();
    expect(document.body.querySelector('.drag-ghost')).toBeNull();
  });
});
