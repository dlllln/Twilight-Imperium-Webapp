// @vitest-environment jsdom
import {
  adjacentSystemIds,
  diplomacySystems,
  type GameState,
  type PlanetId,
  type PlayerId,
  strategyCardId,
  type StrategyCardState,
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
import { TokenGhosts } from '../src/components/map/TokenGhosts.tsx';
import { chipLayout, UnitChips } from '../src/components/map/UnitChips.tsx';
import { CarryAnnouncer } from '../src/components/table/CarryAnnouncer.tsx';
import { usePicking, useSitePicking } from '../src/components/map/use-picking.ts';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { FLAT_VIEW } from '../src/render/board-view.ts';
import { gameScene, type SceneHex } from '../src/render/scene-model.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, DEFAULT_VIEWPORT, useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
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

/** Träger mit zwei Infanteristen über einem freien Planeten; die Landung steht an. */
function landing(): Scene {
  const state = pickAll(started());
  const actor = state.actionPhase?.active as PlayerId;
  const system = freeWorldNear(state, actor);
  const planet = state.systems[system]?.planetIds[0] as PlanetId;
  const troops = [
    figure('traeger', 'carrier', actor),
    figure('inf-1', 'infantry', actor),
    figure('inf-2', 'infantry', actor),
  ];
  seatTable(stepAt(state, system, 'invasion', troops), { me: actor });
  return { planet, system };
}

const EMBASSY = strategyCardId('embassy');

/** Der Aktive hält die Diplomatie und hat sie aus der Hand gewählt. */
function diplomacy(): PlayerId {
  const state = pickAll(started());
  const actor = state.actionPhase?.active as PlayerId;
  const card = { ...(state.strategyCards[EMBASSY] as StrategyCardState), holder: actor };
  seatTable(
    { ...state, strategyCards: { ...state.strategyCards, [EMBASSY]: card } },
    { me: actor },
  );
  act(() => useHandStore.getState().choose({ player: actor, card: EMBASSY }));
  return actor;
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
      <TokenGhosts {...frame} size={SIZE} />
      {state !== null && <CarryAnnouncer game={state} />}
    </>
  );
}

function ringOf(planet: PlanetId): Element {
  const ring = document.querySelector(`svg .site-target[data-planet="${planet}"]`);
  if (ring === null) throw new Error(`kein Ring um ${planet}`);
  return ring;
}

const game = () => useGameStore.getState().game as GameState;

function chip(unit: string): Element {
  const found = document.querySelector(`[data-piece="unit:${unit}"]`);
  if (found === null) throw new Error(`keine Figur ${unit}`);
  return found;
}

const space = (): Element => document.querySelector('.unit-chip-space') as Element;

describe('Figuren im aktivierten System', () => {
  it('Landung: Figur aufnehmen und auf einem grünen Ring ablegen weist sie dem Planeten zu', () => {
    const { planet } = landing();
    const pan = vi.fn();
    render(
      <div onPointerDown={pan} onPointerMove={pan}>
        <Table flyTo={vi.fn()} />
      </div>,
    );
    expect(document.querySelectorAll('.unit-chip')).toHaveLength(2);
    expect(chip('inf-2').getAttribute('aria-label')).toBe(
      'Einheit aufnehmen: Infanterie · Im Weltraum',
    );
    // Die Karte darunter verschiebt sich nicht, während eine Figur gegriffen wird.
    fireEvent.pointerDown(chip('inf-2'), { button: 0, pointerId: 1 });
    fireEvent.pointerMove(chip('inf-2'), { pointerId: 1 });
    expect(pan).not.toHaveBeenCalled();
    fireEvent.click(chip('inf-2'), { detail: 1 });
    expect(useCarryStore.getState().piece).toEqual({ kind: 'unit', id: 'inf-2' });
    expect(ringOf(planet).getAttribute('data-site-kind')).toBe('landing');
    expect(ringOf(planet).getAttribute('data-target-state')).toBe('legal');
    fireEvent.click(ringOf(planet));
    expect(useDraftStore.getState().draft).toMatchObject({ assignments: { 'inf-2': planet } });
    expect(chip('inf-2').getAttribute('data-assigned')).toBe(planet);
    expect(chip('inf-1').hasAttribute('data-assigned')).toBe(false);
    expect(useCarryStore.getState().news?.kind).toBe('placed');
  });

  it('Landung per Tastatur: Figur aufnehmen, Fokus springt auf den grünen Ring, Enter weist sie zu', () => {
    const { planet } = landing();
    render(<Table flyTo={vi.fn()} />);
    act(() => {
      fireEvent.click(chip('inf-1'), { detail: 0 });
    });
    expect(useCarryStore.getState().mode).toBe('keyboard');
    expect(document.activeElement).toBe(ringOf(planet));
    act(() => {
      fireEvent.keyDown(ringOf(planet), { key: 'Enter' });
    });
    expect(useDraftStore.getState().draft).toMatchObject({ assignments: { 'inf-1': planet } });
    expect(useCarryStore.getState().piece).toBeNull();
    expect(document.activeElement).toBe(chip('inf-1'));
    expect(chip('inf-1').getAttribute('data-assigned')).toBe(planet);
  });

  it('die Figuren stehen in höchstens drei Spalten und schrumpfen mit dem Feld', () => {
    const at = { x: 0, y: 0 };
    expect(chipLayout(at, 2, 600)).toEqual({ at, columns: 2, scale: 1 });
    const crowded = chipLayout(at, 8, 115);
    expect(crowded.columns).toBe(3);
    expect(crowded.scale).toBeLessThan(1);
    // Drei Steine samt Rahmen bleiben schmaler als das Feld.
    expect((3 * 38 + 12) * crowded.scale).toBeLessThan(115);
    expect(chipLayout(at, 1, 0).scale).toBe(1);
  });

  it('eine zugewiesene Figur auf Im Weltraum abgelegt bleibt im Weltraum', () => {
    const { planet } = landing();
    render(<Table flyTo={vi.fn()} />);
    expect(space().hasAttribute('data-target-state')).toBe(false);
    fireEvent.click(ringOf(planet));
    expect(chip('inf-1').getAttribute('data-assigned')).toBe(planet);
    fireEvent.click(chip('inf-1'), { detail: 1 });
    expect(space().getAttribute('data-target-state')).toBe('legal');
    fireEvent.click(space());
    expect(useDraftStore.getState().draft).toMatchObject({ assignments: {} });
    expect(chip('inf-1').hasAttribute('data-assigned')).toBe(false);
    expect(chip('inf-1').getAttribute('aria-label')).toContain('Im Weltraum');
  });

  it('Diplomatie primär: die Marker der anderen erscheinen als Vorschau im gewählten System', () => {
    const actor = diplomacy();
    render(<Table flyTo={vi.fn()} />);
    const [system] = diplomacySystems(game(), actor, content.tiles);
    const ghosts = [...document.querySelectorAll('.token-ghost')];
    const others = game().players.filter((player) => player.id !== actor);
    expect(ghosts.map((ghost) => ghost.getAttribute('data-player'))).toEqual(
      others.map((player) => player.id),
    );
    for (const ghost of ghosts) {
      expect(ghost.getAttribute('data-system')).toBe(system);
      expect(ghost.getAttribute('aria-hidden')).toBe('true');
    }
    expect(ghosts[0]?.getAttribute('title')).toBe(`Marker von ${others[0]?.name ?? ''}`);
  });
});
