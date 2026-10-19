// @vitest-environment jsdom
import { seatPlayerId } from '@stellar/application';
import {
  actionCardId,
  currentActor,
  findPlayer,
  type GameState,
  type PlayerId,
  type PlayerState,
  relicId,
  strategyCardId,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HandDock } from '../src/components/hand/HandDock.tsx';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { PlayerSheet } from '../src/components/sheet/PlayerSheet.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { useLiftStore } from '../src/hand/lift-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

installDomPolyfills();

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true, handOpen: true });
  const empty = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };
  useCarryStore.setState({ ...empty, news: null });
  useDraftStore.getState().clear();
  useHandStore.getState().clear();
  useLiftStore.getState().lower();
});

afterEach(() => {
  cleanup();
  leaveTable();
  Reflect.deleteProperty(document, 'elementsFromPoint');
});

const game = () => useGameStore.getState().game as GameState;
const player = (id: PlayerId) => findPlayer(game(), id) as PlayerState;
const card = (id: string) => screen.getByTestId(`card-${id}`);

/** Ansage und Hand, wie sie am Tisch zusammen liegen; das Pult auf Wunsch dazu. */
function Live({ sheet = false }: { readonly sheet?: boolean }): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      {sheet && <PlayerSheet game={current} />}
      <NoticeStack game={current} />
      <HandDock game={current} />
    </>
  );
}

/** Aktionsphase; die Spieler bekommen in Zugreihenfolge die angegebenen Handkarten. */
function withHands(hands: readonly (readonly string[])[], me?: PlayerId): GameState {
  const state = pickAll(started());
  const order = state.actionPhase?.order ?? [];
  const players = state.players.map((entry) => {
    const hand = hands[order.indexOf(entry.id)] ?? [];
    return { ...entry, actionCards: hand.map(actionCardId) };
  });
  const seated = { ...state, players };
  seatTable(seated, me === undefined ? {} : { me });
  return seated;
}

const OVER_LIMIT = [
  'black-market',
  'black-market',
  'combat-drill',
  'counterplay',
  'mobilization',
  'mobilization',
  'command-reserve',
  'counterplay',
  'combat-drill',
];

describe('Hand am Tisch', () => {
  it('Ablegen am Tisch: Antippen markiert die Karte, das Siegel legt genau die markierten ab', () => {
    withHands([[], OVER_LIMIT]);
    const discarding = currentActor(game()) as PlayerId;
    render(<Live />);
    // Antippen merkt vor, statt auszuspielen; so steht es auch am Knopf.
    expect(card('combat-drill').getAttribute('title')).toBe(
      'Antippen merkt die Karte zum Ablegen vor.',
    );
    fireEvent.click(card('black-market'));
    fireEvent.click(card('black-market'));
    expect(card('black-market').getAttribute('aria-pressed')).toBe('true');
    expect(card('black-market').getAttribute('data-discard')).toBe('2');
    expect(card('black-market').textContent).toContain('Wird abgelegt ×2');
    // Genug vorgemerkt: der nächste Tipp nimmt die Karte ganz zurück.
    fireEvent.click(card('black-market'));
    expect(card('black-market').getAttribute('aria-pressed')).toBe('false');
    expect(card('black-market').querySelector('.hand-discard-ribbon')).toBeNull();
    fireEvent.click(card('combat-drill'));
    fireEvent.click(card('mobilization'));
    expect(card('combat-drill').getAttribute('data-discard')).toBe('1');
    expect(screen.getAllByRole('button', { name: 'Ablegen' })).toHaveLength(1);
    const prompt = screen.getByRole('region', { name: 'Entscheidung' });
    fireEvent.click(within(prompt).getByRole('button', { name: 'Ablegen' }));
    expect(useGameStore.getState().error).toBeNull();
    expect(player(discarding).actionCards).toHaveLength(7);
    expect([...game().actionDeck.discard].sort()).toEqual(['combat-drill', 'mobilization']);
  });

  it('im Reaktionsfenster leuchten spielbare Handkarten', () => {
    withHands([['black-market'], ['counterplay', 'combat-drill']]);
    const order = game().actionPhase?.order ?? [];
    const [active, next] = order as [PlayerId, PlayerId];
    render(<Live />);
    expect(card('black-market').hasAttribute('data-reaction')).toBe(false);
    fireEvent.click(card('black-market'));
    // Der Bildschirm folgt dem Mitspieler, der jetzt verhindern darf.
    expect(currentActor(game())).toBe(next);
    expect(card('counterplay').getAttribute('data-reaction')).toBe('ready');
    expect(card('counterplay').getAttribute('title')).toBe('Jetzt spielbar');
    expect(card('combat-drill').hasAttribute('data-reaction')).toBe(false);
    fireEvent.click(card('counterplay'));
    expect(useGameStore.getState().error).toBeNull();
    expect(player(next).actionCards).toEqual([actionCardId('combat-drill')]);
    expect(player(active).tradeGoods).toBe(0);
  });

  it('Kommandoreserve auf die Flottenleiste gezogen wird gespielt', () => {
    const state = withHands([['command-reserve']]);
    const active = currentActor(state) as PlayerId;
    const fleet = player(active).commandPools.fleet;
    const rail = document.createElement('div');
    rail.setAttribute('data-target', 'pool:fleet');
    Object.defineProperty(document, 'elementsFromPoint', {
      value: () => [rail],
      configurable: true,
    });
    render(<Live sheet />);
    const reserve = card('command-reserve');
    fireEvent.pointerDown(reserve, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(reserve, { pointerId: 1, clientX: 40, clientY: -120 });
    const ghost = document.body.querySelector('body > .drag-ghost');
    expect(ghost?.getAttribute('data-material')).toBe('card');
    expect(useCarryStore.getState().legal.has('pool:fleet')).toBe(true);
    fireEvent.pointerUp(reserve, { pointerId: 1, clientX: 40, clientY: -120 });
    fireEvent.click(reserve);
    expect(useGameStore.getState().error).toBeNull();
    expect(player(active).commandPools.fleet).toBe(fleet + 1);
    expect(player(active).actionCards).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ein Relikt hebt sich beim ersten Antippen und wirkt erst beim zweiten', () => {
    const state = pickAll(started());
    const actor = currentActor(state) as PlayerId;
    const relics = [{ id: relicId('trade-prism'), exhausted: false }];
    const players = state.players.map((entry) =>
      entry.id === actor ? { ...entry, relics } : entry,
    );
    seatTable({ ...state, players }, { me: actor });
    const goods = player(actor).tradeGoods;
    render(<Live />);
    const relic = () => screen.getByTestId('relic-trade-prism');
    expect(relic().getAttribute('title')).toBe(
      'Antippen hebt die Karte an, ein zweites Antippen spielt sie aus.',
    );
    fireEvent.click(relic());
    expect(relic().getAttribute('data-lifted')).toBe('true');
    expect(relic().getAttribute('title')).toBe('Angehoben – noch einmal tippen zum Ausspielen');
    expect(relic().getAttribute('aria-pressed')).toBe('true');
    expect(relic().getAttribute('aria-description')).toBe(
      'Angehoben – noch einmal tippen zum Ausspielen',
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(relic().hasAttribute('data-lifted')).toBe(false);
    expect(player(actor).tradeGoods).toBe(goods);
    fireEvent.click(relic());
    fireEvent.click(relic());
    expect(player(actor).tradeGoods).toBe(goods + 2);
  });

  it('Escape senkt die angehobene Karte und schließt trotzdem, was außerhalb der Hand offen ist', () => {
    const state = pickAll(started());
    const actor = currentActor(state) as PlayerId;
    const relics = [{ id: relicId('trade-prism'), exhausted: false }];
    const players = state.players.map((entry) =>
      entry.id === actor ? { ...entry, relics } : entry,
    );
    seatTable({ ...state, players }, { me: actor });
    render(<Live />);
    const relic = () => screen.getByTestId('relic-trade-prism');
    const heard: string[] = [];
    const listen = (event: KeyboardEvent) => heard.push(event.key);
    document.addEventListener('keydown', listen);
    try {
      fireEvent.click(relic());
      const outside = document.createElement('button');
      document.body.append(outside);
      outside.focus();
      fireEvent.keyDown(outside, { key: 'Escape' });
      expect(relic().hasAttribute('data-lifted')).toBe(false);
      expect(heard).toEqual(['Escape']);
      outside.remove();
      fireEvent.click(relic());
      relic().focus();
      fireEvent.keyDown(relic(), { key: 'Escape' });
      expect(relic().hasAttribute('data-lifted')).toBe(false);
      expect(heard).toEqual(['Escape']);
    } finally {
      document.removeEventListener('keydown', listen);
    }
  });

  it('eingeklappt öffnet sich die Hand, solange über ihr entschieden wird (Ablegen)', () => {
    useSettingsStore.setState({ handOpen: false });
    withHands([[], OVER_LIMIT]);
    render(<Live />);
    const dock = screen.getByRole('region', { name: 'Deine Hand' });
    expect(dock.classList.contains('raised')).toBe(true);
    expect(within(dock).queryByRole('button', { name: 'Hand ausklappen' })).toBeNull();
  });

  it('eine getragene Karte bleibt blass im Fächer liegen, statt angehoben über dem Tisch zu stehen', async () => {
    withHands([['command-reserve']]);
    const rail = document.createElement('div');
    rail.setAttribute('data-target', 'pool:fleet');
    Object.defineProperty(document, 'elementsFromPoint', {
      value: () => [rail],
      configurable: true,
    });
    render(<Live sheet />);
    const reserve = card('command-reserve');
    fireEvent.pointerDown(reserve, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(reserve, { pointerId: 1, clientX: 40, clientY: -120 });
    expect(reserve.getAttribute('data-carried')).toBe('true');
    await waitFor(() => expect(reserve.style.opacity).toBe('0.45'));
    expect(reserve.style.transform).not.toContain('scale(1.8)');
    fireEvent.pointerCancel(reserve, { pointerId: 1 });
    await waitFor(() => expect(reserve.style.opacity).toBe('1'));
  });

  it('bei kostenpflichtiger Sekundärfähigkeit ist der oberste Strategiemarker als bezahlt markiert', () => {
    const state = pickAll(started());
    const turn = state.actionPhase;
    const follower =
      state.players.find((entry) => entry.id !== turn?.active)?.id ?? seatPlayerId(1);
    const follow = (card: string) => {
      if (turn === null) throw new Error('keine Aktionsphase');
      const secondary = { card: strategyCardId(card), awaiting: [follower], free: [] };
      return { ...state, actionPhase: { ...turn, secondary } };
    };
    seatTable(follow('embassy'), { me: follower });
    render(<Live sheet />);
    const tray = screen.getByLabelText('Strategie: 2 · wird bezahlt');
    const marks = tray.querySelectorAll('[data-spending="true"]');
    expect(marks).toHaveLength(1);
    expect((marks[0] as HTMLElement).style.gridColumn).toBe('2');
    expect(marks[0]?.getAttribute('title')).toBe('wird bezahlt');
    act(() => useGameStore.setState({ game: follow('vanguard') }));
    expect(screen.getByLabelText('Strategie: 2').querySelector('[data-spending]')).toBeNull();
  });
});
