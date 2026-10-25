// @vitest-environment jsdom
import {
  currentActor,
  findPlayer,
  type GameState,
  type PlayerId,
  unitId,
  unitTypeId,
  updatePlayer,
} from '@stellar/domain';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { PlayerRail } from '../src/components/hud/PlayerRail.tsx';
import { PlayerSheet } from '../src/components/sheet/PlayerSheet.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { useTradeStore } from '../src/table/trade-store.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

installDomPolyfills();

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  const empty = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };
  useCarryStore.setState({ ...empty, news: null });
  useDraftStore.getState().clear();
  useHandStore.getState().clear();
  useTradeStore.getState().clear();
});

afterEach(() => {
  cleanup();
  leaveTable();
  Reflect.deleteProperty(document, 'elementsFromPoint');
});

const game = () => useGameStore.getState().game as GameState;
const nameOf = (id: PlayerId) => findPlayer(game(), id)?.name ?? '?';
const prompt = () => screen.getByRole('region', { name: 'Entscheidung' });
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
const count = (name: string) => screen.getByRole('status', { name }).textContent;
const portrait = (id: PlayerId) => button(nameOf(id));

/** Pult, Porträts und Ansage, die dem Spielstand folgen. */
function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  if (current === null) return null;
  return (
    <>
      <PlayerSheet game={current} />
      <PlayerRail game={current} />
      <NoticeStack game={current} />
    </>
  );
}

interface Table {
  readonly player: PlayerId;
  readonly partners: readonly PlayerId[];
}

interface Stock {
  /** Wie viele Mitspieler einen Kreuzer in der Heimat des Aktiven haben (Nachbarn werden). */
  readonly guests?: number;
  readonly commodities?: number;
}

/** Kreuzer der Mitspieler in der Heimat des Aktiven machen sie zu Nachbarn. */
function visited(state: GameState, player: PlayerId, guests: readonly PlayerId[]): GameState {
  const home = homeSystemOf(state, player, content) as string;
  const system = state.systems[home] as GameState['systems'][string];
  const ships = guests.map((owner, index) => ({
    id: unitId(`gast-${String(index)}`),
    type: unitTypeId('cruiser'),
    owner,
    damaged: false,
  }));
  const spaceUnits = [...system.spaceUnits, ...ships];
  return { ...state, systems: { ...state.systems, [home]: { ...system, spaceUnits } } };
}

/** Aktionsphase am Tisch; jeder hat drei Handelswaren, der Aktive dazu Rohstoffe. */
function trading({ guests = 1, commodities = 0 }: Stock = {}): Table {
  const state = pickAll(started());
  const player = state.actionPhase?.active as PlayerId;
  const partners = state.players
    .map((p) => p.id)
    .filter((id) => id !== player)
    .slice(0, guests);
  const rich = state.players.reduce(
    (current, p) => updatePlayer(current, p.id, (s) => ({ ...s, tradeGoods: 3 })),
    visited(state, player, partners),
  );
  seatTable(updatePlayer(rich, player, (p) => ({ ...p, commodities })));
  return { player, partners };
}

/** Zieht ein Stück auf ein Element (das Ziel liefert `elementsFromPoint`). */
function dragOnto(piece: HTMLElement, target: HTMLElement): void {
  Object.defineProperty(document, 'elementsFromPoint', {
    value: () => [target],
    configurable: true,
  });
  fireEvent.pointerDown(piece, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(piece, { pointerId: 1, clientX: 40, clientY: 20 });
  fireEvent.pointerUp(piece, { pointerId: 1, clientX: 40, clientY: 20 });
}

describe('Handelsmatte (RR 82) in der Tischansicht', () => {
  it('Tischansicht: der Tausch liegt als Handelsmatte in der Ansage, nicht als Formular', () => {
    trading();
    render(<Live />);
    const mat = prompt().querySelector('details.trade-mat');
    expect(mat?.querySelector('summary')?.textContent).toBe('Tausch mit Nachbarn');
    expect(mat?.getAttribute('aria-label')).toBe('Handelsmatte');
    expect(within(prompt()).getByRole('region', { name: 'Du gibst' })).toBeTruthy();
    expect(within(prompt()).getByRole('region', { name: 'Du erbittest' })).toBeTruthy();
    expect(within(prompt()).getByRole('radiogroup', { name: 'Nachbar' })).toBeTruthy();
    expect(prompt().querySelector('.stepper')).toBeNull();
    // Ohne Partner lässt sich nichts erbitten.
    expect(button('Erbitten: Handelswaren +').disabled).toBe(true);
  });

  it('Münze auf das Porträt eines Nachbarn ziehen wählt ihn und legt eine Handelsware aufs Angebot', () => {
    const { partners } = trading();
    const partner = partners[0] as PlayerId;
    render(<Live />);
    expect(screen.getByTestId('goods-count').textContent).toBe('3');
    dragOnto(button('Handelsware aufnehmen'), portrait(partner));
    expect(count('Geben: Handelswaren')).toBe('1');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: nameOf(partner) }).checked).toBe(
      true,
    );
    // Die Münze liegt auf der Matte, nicht mehr auf dem Haufen; die Beschriftung zählt alle.
    expect(screen.getByTestId('goods-count').textContent).toBe('2');
    expect(screen.getByLabelText('Handelswaren: 3')).toBeTruthy();
    expect(portrait(partner).getAttribute('aria-describedby')).toBe('portrait-trade-mark');
    expect(document.getElementById('portrait-trade-mark')?.textContent).toBe('Handelspartner');
    expect(portrait(partner).querySelector('.portrait-trade-mark')).toBeTruthy();
    expect(useGameStore.getState().error).toBeNull();
  });

  it('Rohstoff aufnehmen gibt es nur mit Nachbarn und eigenen Rohstoffen', () => {
    trading({ commodities: 0 });
    const first = render(<Live />);
    expect(screen.queryByRole('button', { name: 'Rohstoff aufnehmen' })).toBeNull();
    first.unmount();
    trading({ guests: 0, commodities: 2 });
    const lonely = render(<Live />);
    expect(screen.queryByRole('button', { name: 'Rohstoff aufnehmen' })).toBeNull();
    expect(document.querySelector('.trade-mat')).toBeNull();
    lonely.unmount();
    const { partners } = trading({ commodities: 1 });
    render(<Live />);
    // Tastaturweg: aufnehmen, dann auf das leuchtende Porträt legen.
    fireEvent.click(button('Rohstoff aufnehmen'));
    fireEvent.click(portrait(partners[0] as PlayerId));
    expect(count('Geben: Rohstoffe')).toBe('1');
    // Die einzige Kiste liegt auf der Matte: keine weitere zum Aufnehmen.
    expect(screen.queryByRole('button', { name: 'Rohstoff aufnehmen' })).toBeNull();
  });

  it('ein Wechsel des Nachbarn leert das Verlangte, das Angebot bleibt', () => {
    const { partners } = trading({ guests: 2 });
    const [first, second] = partners as [PlayerId, PlayerId];
    render(<Live />);
    fireEvent.click(screen.getByRole('radio', { name: nameOf(first) }));
    fireEvent.click(button('Geben: Handelswaren +'));
    fireEvent.click(button('Erbitten: Handelswaren +'));
    fireEvent.click(button('Erbitten: Handelswaren +'));
    expect(count('Erbitten: Handelswaren')).toBe('2');
    fireEvent.click(screen.getByRole('radio', { name: nameOf(second) }));
    expect(count('Erbitten: Handelswaren')).toBe('0');
    expect(count('Geben: Handelswaren')).toBe('1');
  });

  it('Angebot machen bleibt gesperrt, solange nichts auf der Matte liegt', () => {
    const { partners } = trading();
    render(<Live />);
    const propose = button('Angebot machen');
    expect(propose.disabled).toBe(true);
    expect(within(prompt()).getByText(/Lege etwas auf die Matte/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: nameOf(partners[0] as PlayerId) }));
    expect(propose.disabled).toBe(true);
    fireEvent.click(button('Erbitten: Handelswaren +'));
    expect(propose.disabled).toBe(false);
    expect(within(prompt()).queryByText(/Lege etwas auf die Matte/)).toBeNull();
    // Der Hinweis bleibt als leere Live-Region im Baum, damit sein Wiederkehren gehört wird.
    const live = prompt().querySelector<HTMLElement>('.trade-mat-hint');
    expect(live?.getAttribute('aria-live')).toBe('polite');
    expect(live?.textContent).toBe('');
    fireEvent.click(button('Erbitten: Handelswaren −'));
    expect(propose.disabled).toBe(true);
  });

  it('der Empfänger sieht das Angebot auf der Matte und nimmt an', () => {
    const { player, partners } = trading();
    const partner = partners[0] as PlayerId;
    render(<Live />);
    dragOnto(button('Handelsware aufnehmen'), portrait(partner));
    fireEvent.click(button('Geben: Handelswaren +'));
    fireEvent.click(button('Angebot machen'));
    expect(currentActor(game())).toBe(partner);
    expect(screen.getByTestId('offer').textContent).toContain('2 Handelswaren');
    const offered = screen.getByRole('region', { name: `${nameOf(player)} bietet` });
    expect(within(offered).getByRole('status', { name: 'Handelswaren' }).textContent).toBe('2');
    expect(within(prompt()).queryByRole('button', { name: /^Geben:/ })).toBeNull();
    fireEvent.click(button('Annehmen'));
    expect(findPlayer(game(), player)?.tradeGoods).toBe(1);
    expect(findPlayer(game(), partner)?.tradeGoods).toBe(5);
    expect(currentActor(game())).toBe(player);
    // Mit diesem einzigen Nachbarn ist in diesem Zug kein weiterer Tausch möglich.
    expect(document.querySelector('.trade-mat')).toBeNull();
  });
});
