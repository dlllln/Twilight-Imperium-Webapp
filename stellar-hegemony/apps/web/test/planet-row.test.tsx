// @vitest-environment jsdom
import {
  type ExplorationCardId,
  findPlanetDefinition,
  type GameState,
  type PlanetId,
  type PlayerId,
  spendablePlanets,
  strategyCardId,
  updatePlayer,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlayerSheet } from '../src/components/sheet/PlayerSheet.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { planetCardText, planetRow } from '../src/hud/planet-row.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { usePaymentStore, NO_PAYMENTS } from '../src/table/payment-store.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

installDomPolyfills();

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  usePaymentStore.setState(NO_PAYMENTS);
  const empty = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };
  useCarryStore.setState({ ...empty, news: null });
  useDraftStore.getState().clear();
  useHandStore.getState().clear();
});

afterEach(() => {
  cleanup();
  leaveTable();
  useHandStore.getState().clear();
});

const EMBASSY = strategyCardId('embassy');
const LEADERSHIP = strategyCardId('vanguard');

function Live(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  return current === null ? null : <PlayerSheet game={current} />;
}

const row = () => screen.getByRole('region', { name: 'Deine Planeten' });
const checkboxes = () => within(row()).queryAllByRole('checkbox');
const kasseCount = () => screen.getByTestId('kasse-count').textContent;
const goodsCount = () => screen.getByTestId('goods-count').textContent;
const announced = () => document.querySelector('p.sr-only[aria-live]')?.textContent;

/** Ein freier Planet mit mindestens so viel Einfluss geht an den Spieler. */
function givePlanet(game: GameState, player: PlayerId, influence = 0, exhausted = false) {
  const planet = Object.values(game.planets).find(
    (candidate) =>
      candidate.controller === null &&
      (findPlanetDefinition(content.tiles, candidate.id)?.influence ?? 0) >= influence,
  );
  if (planet === undefined) throw new Error('kein freier Planet');
  const taken = { ...planet, controller: player, exhausted };
  return { game: { ...game, planets: { ...game.planets, [planet.id]: taken } }, planet: planet.id };
}

/** Aktionsphase; der Aktive sitzt am Bildschirm, hat drei Handelswaren und einen Planeten mehr. */
function seated(change = (game: GameState) => game) {
  const game = pickAll(started());
  const me = game.actionPhase?.active as PlayerId;
  const rich = updatePlayer(game, me, (p) => ({ ...p, tradeGoods: 3 }));
  const state = change(givePlanet(rich, me).game);
  seatTable(state, { me });
  return { me, game: state };
}

/** Das Formular einer Bezahlung steht offen; der Tisch bedient sie mit. */
const claim = (me: PlayerId) =>
  act(() => {
    usePaymentStore
      .getState()
      .claim({ key: 'form', player: me, currency: 'resources', required: 2 });
  });

describe('Planetenreihe am Pult', () => {
  it('ohne offene Bezahlung liegen die Planetenkarten nur zur Ansicht da', () => {
    const { me, game } = seated();
    render(<Live />);
    expect(row().getAttribute('data-mode')).toBe('rest');
    expect(checkboxes()).toHaveLength(0);
    const views = planetRow(game, me, content);
    const cards = within(row()).getAllByRole('listitem');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(
      views.map((view) => planetCardText(view, 'de')),
    );
    expect(screen.queryByTestId('kasse-count')).toBeNull();
  });

  it('bei einer Bezahlung sind bereite Planeten Kontrollkästchen mit ihrem Wert', () => {
    const { me, game } = seated();
    render(<Live />);
    claim(me);
    expect(row().getAttribute('data-mode')).toBe('pay');
    const spendable = spendablePlanets(game, content.tiles, me, 'resources');
    expect(checkboxes()).toHaveLength(spendable.length);
    for (const { planet, value } of spendable) {
      const card = row().querySelector(`[data-target="planet:${planet}"]`);
      expect(card?.getAttribute('role')).toBe('checkbox');
      expect(card?.getAttribute('data-value')).toBe(String(value));
      expect(card?.getAttribute('aria-checked')).toBe('false');
    }
    expect(kasseCount()).toBe('0');
  });

  it('ein Klick merkt den Planeten vor, ein zweiter gibt ihn frei', () => {
    const { me } = seated();
    render(<Live />);
    claim(me);
    const [card] = checkboxes();
    if (card === undefined) throw new Error('keine Karte');
    fireEvent.click(card);
    expect(card.getAttribute('aria-checked')).toBe('true');
    expect(card.getAttribute('data-turn')).toBe('30');
    expect(card.getAttribute('data-target-state')).toBe('chosen');
    expect(card.getAttribute('title')).toContain('vorgemerkt');
    expect(usePaymentStore.getState().drafts['form']?.plan.planets).toEqual([
      card.getAttribute('data-planet'),
    ]);
    fireEvent.click(card);
    expect(card.getAttribute('aria-checked')).toBe('false');
    expect(card.getAttribute('data-turn')).toBe('0');
    expect(usePaymentStore.getState().drafts['form']?.plan.planets).toEqual([]);
  });

  it('erschöpfte Planeten liegen quer und lassen sich nicht wählen', () => {
    let tired: PlanetId | null = null;
    const { me, game } = seated((state) => {
      const given = givePlanet(state, state.actionPhase?.active as PlayerId, 0, true);
      tired = given.planet;
      return given.game;
    });
    render(<Live />);
    claim(me);
    const view = planetRow(game, me, content).find((entry) => entry.id === tired);
    if (view === undefined) throw new Error('kein erschöpfter Planet');
    const label = planetCardText(view, 'de');
    expect(label).toMatch(/, erschöpft$/);
    expect(within(row()).queryByRole('checkbox', { name: label })).toBeNull();
    const card = within(row()).getByRole('listitem', { name: label });
    expect(card.getAttribute('data-turn')).toBe('90');
    expect(card.getAttribute('data-exhausted')).toBe('true');
  });

  it('Kasse plus und minus legen Handelswaren in die Bezahlung, höchstens so viele wie vorhanden', () => {
    const { me } = seated();
    render(<Live />);
    claim(me);
    const minus = screen.getByRole('button', { name: 'Kasse −' });
    const plus = screen.getByRole('button', { name: 'Kasse +' });
    expect(minus.hasAttribute('disabled')).toBe(true);
    for (let coin = 0; coin < 3; coin += 1) fireEvent.click(plus);
    expect(kasseCount()).toBe('3');
    expect(plus.hasAttribute('disabled')).toBe(true);
    expect(usePaymentStore.getState().drafts['form']?.plan.tradeGoods).toBe(3);
    fireEvent.click(minus);
    expect(kasseCount()).toBe('2');
    expect(usePaymentStore.getState().drafts['form']?.plan.tradeGoods).toBe(2);
  });

  it('Handelsware per Enter aufnehmen und in der Kasse ablegen', () => {
    const { me } = seated();
    render(<Live />);
    claim(me);
    const coin = screen.getByRole('button', { name: 'Handelsware aufnehmen' });
    expect(coin.getAttribute('data-piece')).toBe('goods:tradeGoods');
    fireEvent.click(coin, { detail: 0 });
    expect(coin.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Kasse: 0' }), { key: 'Enter' });
    expect(kasseCount()).toBe('1');
    expect(goodsCount()).toBe('2');
    expect(useCarryStore.getState().piece).toBeNull();
    const back = screen.getByRole('button', { name: 'Handelsware aufnehmen: Kasse' });
    fireEvent.click(back, { detail: 0 });
    expect(announced()).toBe('Aufgenommen: Handelsware. Wähle ein Ziel, Escape legt zurück.');
    const pile = screen.getByRole('button', { name: 'Handelswaren: 3 (1 in der Kasse)' });
    fireEvent.keyDown(pile, { key: 'Enter' });
    expect(kasseCount()).toBe('0');
    expect(goodsCount()).toBe('3');
  });

  it('ohne Handelswaren bleibt die Kasse weg', () => {
    const { me } = seated((state) =>
      updatePlayer(state, state.actionPhase?.active as PlayerId, (p) => ({ ...p, tradeGoods: 0 })),
    );
    render(<Live />);
    claim(me);
    expect(row().getAttribute('data-mode')).toBe('pay');
    expect(screen.queryByTestId('kasse-count')).toBeNull();
  });
});

describe('Planetenreihe in Entscheidungen am Tisch', () => {
  it('Führung: ein Einflussplanet erhöht die neuen Marker', () => {
    let rich: PlanetId | null = null;
    const { me } = seated((state) => {
      const given = givePlanet(state, state.actionPhase?.active as PlayerId, 3);
      rich = given.planet;
      return given.game;
    });
    render(<Live />);
    act(() => useHandStore.getState().choose({ player: me, card: LEADERSHIP }));
    expect(row().getAttribute('data-mode')).toBe('pay');
    expect(screen.getByRole('group', { name: 'Neue Marker: 3' })).toBeTruthy();
    const card = row().querySelector(`[data-target="planet:${String(rich)}"]`);
    if (!(card instanceof HTMLElement)) throw new Error('keine Karte');
    const influence = Number(card.getAttribute('data-value'));
    expect(influence).toBeGreaterThanOrEqual(3);
    fireEvent.click(card);
    expect(card.getAttribute('aria-checked')).toBe('true');
    const gained = 3 + Math.floor(influence / 3);
    expect(screen.getByRole('group', { name: `Neue Marker: ${String(gained)}` })).toBeTruthy();
  });

  it('Diplomatie sekundär: erschöpfte Planeten richten sich als Vorschau auf', () => {
    const game = pickAll(started());
    const turn = game.actionPhase;
    if (turn === null) throw new Error('keine Aktionsphase');
    const me = game.players.find((player) => player.id !== turn.active)?.id as PlayerId;
    const open = {
      ...game,
      actionPhase: { ...turn, secondary: { card: EMBASSY, awaiting: [me], free: [] } },
    };
    const { game: tired, planet } = givePlanet(open, me, 0, true);
    seatTable(tired, { me });
    render(<Live />);
    expect(row().getAttribute('data-mode')).toBe('ready');
    const card = row().querySelector(`[data-target="planet:${planet}"]`);
    if (!(card instanceof HTMLElement)) throw new Error('keine Karte');
    expect(checkboxes()).toHaveLength(1);
    expect(card.getAttribute('data-turn')).toBe('90');
    expect(card.getAttribute('data-value')).toBe('0');
    fireEvent.click(card);
    expect(card.getAttribute('aria-checked')).toBe('true');
    expect(card.getAttribute('data-turn')).toBe('0');
    expect(screen.queryByTestId('kasse-count')).toBeNull();
  });
});

describe('Planetenreihe als Modell', () => {
  it('Heimatplaneten liegen vorn', () => {
    const { me, game } = seated();
    const views = planetRow(game, me, content);
    const homes = views.filter((view) => view.home).length;
    expect(homes).toBeGreaterThan(0);
    expect(homes).toBeLessThan(views.length);
    expect(views.slice(0, homes).every((view) => view.home)).toBe(true);
    expect(views.slice(homes).some((view) => view.home)).toBe(false);
  });

  it('Anlagen zählen beim Wert mit', () => {
    const { me, game } = seated();
    const [first] = planetRow(game, me, content);
    if (first === undefined) throw new Error('kein Planet');
    const planet = game.planets[first.id];
    if (planet === undefined) throw new Error('kein Planet');
    const attachment = { card: 'probe' as ExplorationCardId, resources: 2, influence: 1 };
    const attached = { ...planet, attachments: [attachment] };
    const changed = { ...game, planets: { ...game.planets, [first.id]: attached } };
    const view = planetRow(changed, me, content).find((entry) => entry.id === first.id);
    expect(view?.resources).toBe(first.resources + 2);
    expect(view?.influence).toBe(first.influence + 1);
  });
});
