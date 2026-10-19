// @vitest-environment jsdom
import {
  actionCardId,
  adjacentSystemIds,
  type GameState,
  handCards,
  type PlanetId,
  type PlayerId,
  type SystemId,
  type TacticalStep,
  type Unit,
  unitId,
  unitTypeId,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { type ReactElement, useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { HexTargets } from '../src/components/map/HexTargets.tsx';
import { UnitChips } from '../src/components/map/UnitChips.tsx';
import { usePicking, useSitePicking } from '../src/components/map/use-picking.ts';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { FLAT_VIEW } from '../src/render/board-view.ts';
import { gameScene, type SceneHex } from '../src/render/scene-model.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, DEFAULT_VIEWPORT, useGalaxyStore } from '../src/store.ts';
import { cardTargetKeys } from '../src/table/card-targets.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { actionPiece } from '../src/table/target-ref.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { NO_PAYMENTS, usePaymentStore } from '../src/table/payment-store.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

installDomPolyfills();

const BOUNDS = { minX: -1000, minY: -1000, width: 2000, height: 2000 };
const BAND = { top: 0, bottom: 2000 };
const SIZE = { width: 1000, height: 800 };

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  const empty = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };
  useCarryStore.setState({ ...empty, news: null });
  useDraftStore.getState().clear();
  useHandStore.getState().clear();
  usePaymentStore.setState(NO_PAYMENTS);
});

afterEach(() => {
  cleanup();
  leaveTable();
});

const figure = (id: string, type: string, owner: PlayerId): Unit => ({
  id: unitId(id),
  type: unitTypeId(type),
  owner,
  damaged: false,
});

/** Ein Nachbarsystem der Heimat ohne Anomalie, dessen Planeten noch niemandem gehören. */
function freeWorldNear(state: GameState, player: PlayerId): SystemId {
  const home = state.systems[homeSystemOf(state, player, content) ?? ''];
  if (home === undefined) throw new Error('keine Heimat');
  const found = adjacentSystemIds(state.systems, home).find((id) => {
    const system = state.systems[id];
    return (
      system?.anomaly === undefined &&
      system?.planetIds.some((planet) => state.planets[planet]?.controller === null) === true
    );
  });
  if (found === undefined) throw new Error('kein freier Planet');
  return found;
}

/** Der Aktive steht mit `units` im Weltraum von `system`; die taktische Aktion ist bei `step`. */
function stepAt(state: GameState, system: SystemId, step: TacticalStep, units: readonly Unit[]) {
  const tile = state.systems[system] as GameState['systems'][string];
  const tactical = { system, step, pendingHits: [], combat: null, windows: [], bonuses: [] };
  return {
    ...state,
    systems: { ...state.systems, [system]: { ...tile, spaceUnits: units } },
    actionPhase: state.actionPhase && { ...state.actionPhase, tactical },
  };
}

interface Scene {
  readonly planet: PlanetId;
  readonly system: SystemId;
}

/** Ein Schlachtschiff über einem Planeten, auf dem gegnerische Infanterie steht. */
function bombarding(): Scene {
  const state = pickAll(started());
  const actor = state.actionPhase?.active as PlayerId;
  const enemy = state.players.find((p) => p.id !== actor)?.id as PlayerId;
  const system = freeWorldNear(state, actor);
  const planet = state.systems[system]?.planetIds[0] as PlanetId;
  const world = state.planets[planet] as GameState['planets'][string];
  const held = {
    ...state.planets,
    [planet]: { ...world, controller: enemy, units: [figure('feind', 'infantry', enemy)] },
  };
  const ships = [figure('bs', 'dreadnought', actor)];
  seatTable(stepAt({ ...state, planets: held }, system, 'bombardment', ships), { me: actor });
  return { planet, system };
}

/** Karte mit Trefferflächen und Figuren; Heranfahren wird nur mitgeschrieben. */
function Table({ flyTo }: { readonly flyTo: (hex: SceneHex) => void }): ReactElement | null {
  const state = useGameStore((store) => store.game);
  const hexes = useMemo(() => (state === null ? [] : gameScene(state, content, 'de')), [state]);
  const pick = usePicking(() => false, flyTo);
  const site = useSitePicking(() => false);
  const frame = { hexes, view: FLAT_VIEW, viewport: DEFAULT_VIEWPORT, bounds: BOUNDS };
  return (
    <>
      <HexTargets {...frame} band={BAND} onPick={pick} onView={flyTo} onSite={site} />
      <UnitChips {...frame} size={SIZE} />
    </>
  );
}

const rings = () => [...document.querySelectorAll('svg .site-target')];

function ringOf(planet: PlanetId): Element {
  const ring = document.querySelector(`svg .site-target[data-planet="${planet}"]`);
  if (ring === null) throw new Error(`kein Ring um ${planet}`);
  return ring;
}

describe('Planeten als Ziele auf der Karte', () => {
  it('Bombardement: rote Ringe nur um bombardierbare Planeten, ein Klick weist das nächste Schiff zu', () => {
    const { planet } = bombarding();
    render(<Table flyTo={vi.fn()} />);
    expect(rings().map((ring) => ring.getAttribute('data-planet'))).toEqual([planet]);
    const ring = ringOf(planet);
    expect(ring.getAttribute('data-site-kind')).toBe('bombard');
    expect(ring.getAttribute('data-target')).toBe(`site:${planet}`);
    expect(ring.getAttribute('data-target-state')).toBe('legal');
    expect(ring.getAttribute('role')).toBe('button');
    expect(ring.getAttribute('aria-label')).toContain('Ziel für Bombardement');
    fireEvent.click(ring);
    expect(useDraftStore.getState().draft).toMatchObject({ assignments: { bs: planet } });
    expect(ringOf(planet).getAttribute('data-target-state')).toBe('chosen');
    expect(document.querySelector('svg .site-count')?.textContent).toBe('1');
    expect(document.querySelector('[data-piece="unit:bs"]')?.getAttribute('data-assigned')).toBe(
      planet,
    );
  });

  it('ein Klick auf einen Ring wählt nicht das System', () => {
    const { planet } = bombarding();
    const flyTo = vi.fn();
    render(<Table flyTo={flyTo} />);
    fireEvent.keyDown(ringOf(planet), { key: 'Enter' });
    expect(useDraftStore.getState().draft).toMatchObject({ assignments: { bs: planet } });
    fireEvent.click(ringOf(planet));
    expect(useGameStore.getState().selected).toBeNull();
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('beim Bombardement treten die Knöpfe am gewählten System zurück, damit sie keinen Ring verdecken', () => {
    const { system } = bombarding();
    useGameStore.getState().select(system);
    render(<Table flyTo={vi.fn()} />);
    expect(rings()).toHaveLength(1);
    expect(document.querySelector('.system-actions')).toBeNull();
    act(() => useSettingsStore.setState({ tableView: false }));
    expect(document.querySelector('.system-actions')).not.toBeNull();
  });

  it('klassische Ansicht: keine Ringe und keine Figuren', () => {
    useSettingsStore.setState({ tableView: false });
    bombarding();
    render(<Table flyTo={vi.fn()} />);
    expect(rings()).toHaveLength(0);
    expect(document.querySelectorAll('.unit-chip')).toHaveLength(0);
    expect(document.querySelectorAll('.unit-chip-space')).toHaveLength(0);
  });
});

/** Der Aktive hält `card`; `change` richtet den Spielstand für die Ziele der Karte her. */
function holding(card: string, change: (state: GameState, me: PlayerId) => GameState): PlayerId {
  const start = pickAll(started());
  const me = start.actionPhase?.active as PlayerId;
  const players = start.players.map((entry) =>
    entry.id === me ? { ...entry, actionCards: [actionCardId(card)] } : entry,
  );
  seatTable(change({ ...start, players }, me), { me });
  return me;
}

/** Die Karte aus der Hand aufnehmen, mit den Zielen, die die Domain ihr anbietet. */
function carry(card: string, me: PlayerId): void {
  const state = useGameStore.getState().game as GameState;
  const entry = handCards(state, me, content).find((hand) => hand.definition.id === card);
  if (entry?.playable !== true) throw new Error(`${card} ist nicht spielbar`);
  act(() =>
    useCarryStore.getState().pickUp(actionPiece(card), cardTargetKeys(entry.targets), 'sticky'),
  );
}

/** Ein eigener Planet ist erschöpft: Ziel für die Reaktivierung. */
function exhaustOwn(state: GameState, me: PlayerId): GameState {
  const own = Object.values(state.planets).find((planet) => planet.controller === me);
  if (own === undefined) throw new Error('kein eigener Planet');
  return { ...state, planets: { ...state.planets, [own.id]: { ...own, exhausted: true } } };
}

const exhaustedPlanet = (): PlanetId => {
  const state = useGameStore.getState().game as GameState;
  const found = Object.values(state.planets).find((planet) => planet.exhausted);
  if (found === undefined) throw new Error('kein erschöpfter Planet');
  return found.id;
};

/** Ein eigener Kommandomarker liegt in einem Nachbarsystem: Ziel für den Rückruf. */
function tokenNear(state: GameState, me: PlayerId): GameState {
  const system = freeWorldNear(state, me);
  const tile = state.systems[system] as GameState['systems'][string];
  const placed = { ...tile, commandTokens: [...tile.commandTokens, me] };
  return { ...state, systems: { ...state.systems, [system]: placed } };
}

describe('Ziele einer getragenen Aktionskarte auf der Karte', () => {
  it('eine getragene Aktionskarte lässt ihre Planeten als Ziele der Karte leuchten', () => {
    const me = holding('reactivation', exhaustOwn);
    render(<Table flyTo={vi.fn()} />);
    expect(rings()).toHaveLength(0);
    carry('reactivation', me);
    const planet = exhaustedPlanet();
    expect(rings().map((ring) => ring.getAttribute('data-planet'))).toEqual([planet]);
    const ring = ringOf(planet);
    expect(ring.getAttribute('data-site-kind')).toBe('card');
    expect(ring.getAttribute('data-target-state')).toBe('legal');
    expect(ring.getAttribute('aria-label')).toContain('Ziel der Karte');
    act(() => useCarryStore.getState().putDown());
    expect(rings()).toHaveLength(0);
  });

  it('Antippen eines Kartenziels spielt die Karte', () => {
    const me = holding('recruitment', (state) => state);
    const flyTo = vi.fn();
    render(<Table flyTo={flyTo} />);
    carry('recruitment', me);
    const planet = rings()[0]?.getAttribute('data-planet') as PlanetId;
    const before = (useGameStore.getState().game as GameState).planets[planet]?.units.length ?? 0;
    fireEvent.click(ringOf(planet));
    const game = useGameStore.getState().game as GameState;
    expect(useGameStore.getState().error).toBeNull();
    expect(game.planets[planet]?.units).toHaveLength(before + 2);
    expect(game.players.find((entry) => entry.id === me)?.actionCards).toHaveLength(0);
    expect(useCarryStore.getState().piece).toBeNull();
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('ein System als Ziel der getragenen Karte leuchtet, Enter spielt sie dort statt es zu wählen', () => {
    const me = holding('recall', tokenNear);
    const flyTo = vi.fn();
    render(<Table flyTo={flyTo} />);
    carry('recall', me);
    const [key] = [...useCarryStore.getState().legal];
    const hex = document.querySelector(`svg polygon[data-target="${String(key)}"]`);
    if (hex === null) throw new Error('kein System als Ziel');
    expect(hex.getAttribute('class')).toContain('target-legal');
    fireEvent.keyDown(hex, { key: 'Enter' });
    const system = String(key).replace('system:', '');
    const game = useGameStore.getState().game as GameState;
    expect(useGameStore.getState().error).toBeNull();
    expect(game.systems[system]?.commandTokens).not.toContain(me);
    expect(useGameStore.getState().selected).toBeNull();
    expect(flyTo).not.toHaveBeenCalled();
  });
});
