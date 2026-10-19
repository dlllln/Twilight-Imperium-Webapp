// @vitest-environment jsdom
import {
  type GameState,
  type PlanetId,
  type PlayerId,
  readyablePlanets,
  spendablePlanets,
  strategyCardId,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { type ReactElement, useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlanetTargets } from '../src/components/map/PlanetTargets.tsx';
import { usePlanetPicking } from '../src/components/map/use-picking.ts';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { FLAT_VIEW } from '../src/render/board-view.ts';
import { gameScene } from '../src/render/scene-model.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { usePaymentStore, NO_PAYMENTS } from '../src/table/payment-store.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable } from './local-table.ts';

const EMBASSY = strategyCardId('embassy');
const OPEN_KEY = 'produktion';

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ tableView: true, animations: false });
  usePaymentStore.setState(NO_PAYMENTS);
  useDraftStore.getState().clear();
  useHandStore.getState().clear();
});

afterEach(() => {
  cleanup();
  leaveTable();
});

const game = (): GameState => useGameStore.getState().game as GameState;

/** Die Karte mit Planetenzielen; `dragged` sagt, ob die Geste ein Ziehen der Karte war. */
function Board({ dragged = false }: { readonly dragged?: boolean }): ReactElement | null {
  const state = useGameStore((store) => store.game);
  const hexes = useMemo(() => (state === null ? [] : gameScene(state, content, 'de')), [state]);
  const onPlanet = usePlanetPicking(() => dragged);
  if (state === null) return null;
  return (
    <svg>
      <PlanetTargets game={state} hexes={hexes} view={FLAT_VIEW} onPlanet={onPlanet} />
    </svg>
  );
}

/** Aktionsphase; der Aktive sitzt am Bildschirm und hat dazu einen erschöpften Planeten. */
function seated(): { readonly me: PlayerId; readonly tired: PlanetId } {
  const state = pickAll(started());
  const me = state.actionPhase?.active as PlayerId;
  const free = Object.values(state.planets).find((planet) => planet.controller === null);
  if (free === undefined) throw new Error('kein freier Planet');
  const own = { ...free, controller: me, exhausted: true };
  const planets = { ...state.planets, [own.id]: own };
  useGameStore.setState({ game: { ...state, planets }, me });
  return { me, tired: own.id };
}

/** Ein Formular zeigt eine Bezahlung in Ressourcen; der Tisch bedient sie mit. */
function openPayment(me: PlayerId): void {
  usePaymentStore
    .getState()
    .claim({ key: OPEN_KEY, player: me, currency: 'resources', required: 2 });
}

const rings = () => [...document.querySelectorAll('svg .planet-target')];
const ringIds = () => rings().map((ring) => ring.getAttribute('data-planet'));

function ringOf(planet: PlanetId): Element {
  const ring = document.querySelector(`.planet-target[data-planet="${planet}"]`);
  if (ring === null) throw new Error(`kein Ring für ${planet}`);
  return ring;
}

const spendable = (me: PlayerId) => spendablePlanets(game(), content.tiles, me, 'resources');

/** Ein fremder Spieler soll die Diplomatie sekundär nutzen; drei eigene Planeten sind erschöpft. */
function diplomacySecondary(): { readonly actor: PlayerId; readonly ready: PlanetId[] } {
  const state = pickAll(started());
  const turn = state.actionPhase;
  const actor = state.players.find((player) => player.id !== turn?.active)?.id as PlayerId;
  if (turn === null) throw new Error('keine Aktionsphase');
  const ready = Object.values(state.planets).filter((p) => p.controller === actor);
  const taken = Object.values(state.planets)
    .filter((planet) => planet.controller === null)
    .slice(0, 3)
    .map((planet) => ({ ...planet, controller: actor, exhausted: true }));
  const planets = { ...state.planets, ...Object.fromEntries(taken.map((p) => [p.id, p])) };
  const actionPhase = { ...turn, secondary: { card: EMBASSY, awaiting: [actor], free: [] } };
  useGameStore.setState({ game: { ...state, planets, actionPhase }, me: actor });
  return { actor, ready: ready.map((planet) => planet.id) };
}

describe('Planeten auf der Karte als Ziele', () => {
  it('ohne Bezahlung gibt es keine Planetenziele auf der Karte', () => {
    seated();
    render(<Board />);
    expect(rings()).toHaveLength(0);
  });

  it('bei einer Bezahlung leuchten nur bereite eigene Planeten', () => {
    const { me, tired } = seated();
    openPayment(me);
    render(<Board />);
    const expected = spendable(me).map((entry) => String(entry.planet));
    expect(expected.length).toBeGreaterThan(0);
    expect(new Set(ringIds())).toEqual(new Set(expected));
    expect(ringIds()).not.toContain(tired);
    for (const ring of rings()) {
      expect(ring.getAttribute('class')).toContain('target-legal');
      expect(ring.getAttribute('aria-hidden')).toBe('true');
      expect(ring.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('ein Klick auf einen Planeten merkt ihn in derselben Bezahlung vor wie die Planetenreihe', () => {
    const { me } = seated();
    openPayment(me);
    render(<Board />);
    const [first] = spendable(me);
    if (first === undefined) throw new Error('kein bezahlbarer Planet');
    expect(ringOf(first.planet).getAttribute('data-value')).toBe(String(first.value));
    act(() => {
      fireEvent.click(ringOf(first.planet));
    });
    expect(usePaymentStore.getState().drafts[OPEN_KEY]?.version).toBe(game().version);
    expect(usePaymentStore.getState().drafts[OPEN_KEY]?.plan.planets).toEqual([first.planet]);
    expect(ringOf(first.planet).getAttribute('data-target-state')).toBe('chosen');
    expect(ringOf(first.planet).getAttribute('class')).toContain('target-chosen');
    expect(ringOf(first.planet).textContent).toContain('vorgemerkt');
    fireEvent.click(ringOf(first.planet));
    expect(usePaymentStore.getState().drafts[OPEN_KEY]?.plan.planets).toEqual([]);
  });

  it('wer die Karte über einen Planeten zieht, wählt ihn nicht', () => {
    const { me } = seated();
    openPayment(me);
    render(<Board dragged />);
    const [first] = spendable(me);
    if (first === undefined) throw new Error('kein bezahlbarer Planet');
    fireEvent.click(ringOf(first.planet));
    expect(usePaymentStore.getState().drafts[OPEN_KEY]).toBeUndefined();
    expect(ringOf(first.planet).getAttribute('data-target-state')).toBe('legal');
  });

  it('Diplomatie sekundär: nur erschöpfte eigene Planeten sind Ziele', () => {
    const { actor, ready } = diplomacySecondary();
    render(<Board />);
    const tired = readyablePlanets(game(), actor).map(String);
    expect(tired).toHaveLength(3);
    expect(new Set(ringIds())).toEqual(new Set(tired));
    for (const planet of ready) expect(ringIds()).not.toContain(planet);
    const [first] = tired;
    fireEvent.click(ringOf(first as PlanetId));
    expect(useDraftStore.getState().draft).toMatchObject({ kind: 'ready', planets: [first] });
    expect(ringOf(first as PlanetId).getAttribute('data-target-state')).toBe('chosen');
  });
});
