// @vitest-environment jsdom
import {
  currentActor,
  type GameState,
  type PlayerId,
  type StrategyCardState,
  strategyCardId,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HexTargets } from '../src/components/map/HexTargets.tsx';
import { usePicking } from '../src/components/map/use-picking.ts';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { FLAT_VIEW } from '../src/render/board-view.ts';
import { gameScene, type SceneHex } from '../src/render/scene-model.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, DEFAULT_VIEWPORT, useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useLegalFor } from '../src/table/carry-rules.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { activatableSystems } from '../src/table/legal-systems.ts';
import { poolTarget } from '../src/table/target-ref.ts';
import { useDragSource } from '../src/table/use-drag-source.ts';
import { useDropRouter } from '../src/table/use-drop-router.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

installDomPolyfills();

const TACTIC = poolTarget('tactic');
const WARFARE = strategyCardId('armament');
const BOUNDS = { minX: -1000, minY: -1000, width: 2000, height: 2000 };
const BAND = { top: 0, bottom: 2000 };

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
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

/** Ein Taktikmarker zum Aufnehmen, wie ihn das Pult anbietet. */
function TacticPiece({ state }: { readonly state: GameState }): ReactElement {
  const legal = useLegalFor(state);
  const props = useDragSource(TACTIC, () => legal(TACTIC), useDropRouter(state));
  return (
    <button type="button" {...props}>
      Taktik
    </button>
  );
}

/** Karte mit Trefferflächen, die dem Spielstand folgt; Heranfahren wird nur mitgeschrieben. */
function Table({ flyTo }: { readonly flyTo: (hex: SceneHex) => void }): ReactElement | null {
  const state = useGameStore((store) => store.game);
  const hexes = useMemo(() => (state === null ? [] : gameScene(state, content, 'de')), [state]);
  const pick = usePicking(() => false, flyTo);
  if (state === null) return null;
  return (
    <>
      <TacticPiece state={state} />
      <HexTargets
        {...{ hexes, view: FLAT_VIEW, viewport: DEFAULT_VIEWPORT, bounds: BOUNDS, band: BAND }}
        onPick={pick}
        onView={flyTo}
      />
    </>
  );
}

/** Aktionsphase; der Spieler am Zug sitzt am Bildschirm. */
function actionPhase(prepare: (state: GameState, me: PlayerId) => GameState = (s) => s): PlayerId {
  const state = pickAll(started());
  const me = currentActor(state) as PlayerId;
  seatTable(prepare(state, me), { me });
  return me;
}

const hexOf = (system: string) => {
  const hex = document.querySelector(`polygon[data-system="${system}"]`);
  if (hex === null) throw new Error(`kein Feld für ${system}`);
  return hex;
};
const piece = () => screen.getByRole('button', { name: 'Taktik' });

/** Zieht den Taktikmarker über das Feld und lässt ihn dort los. */
function dragOnto(system: string): Element {
  const hex = hexOf(system);
  Object.defineProperty(document, 'elementsFromPoint', { value: () => [hex], configurable: true });
  fireEvent.pointerDown(piece(), { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(piece(), { pointerId: 1, clientX: 40, clientY: 20 });
  return hex;
}

const release = () => fireEvent.pointerUp(piece(), { pointerId: 1, clientX: 40, clientY: 20 });

/** Das erste System der Partie; hier legen Tests einen eigenen Marker ab. */
const markedOf = (state: GameState): string => Object.keys(state.systems)[0] as string;

function withOwnToken(state: GameState, me: PlayerId, marked: string): GameState {
  const system = state.systems[marked] as GameState['systems'][string];
  return { ...state, systems: { ...state.systems, [marked]: { ...system, commandTokens: [me] } } };
}

/** Der Aktive hält die Kriegsführung; ein eigener Marker liegt im ersten System. */
function warfareWithToken(state: GameState, me: PlayerId): GameState {
  const card = state.strategyCards[WARFARE] as StrategyCardState;
  const marked = withOwnToken(state, me, markedOf(state));
  return {
    ...marked,
    strategyCards: { ...state.strategyCards, [WARFARE]: { ...card, holder: me } },
  };
}

describe('Systeme auf der Karte als Ablageziele', () => {
  it('Taktikmarker auf ein erlaubtes System gezogen sendet ActivateSystem', () => {
    const me = actionPhase();
    const system = String(activatableSystems(game(), me)[0]);
    render(<Table flyTo={vi.fn()} />);
    const hex = dragOnto(system);
    expect(hex.getAttribute('data-target')).toBe(`system:${system}`);
    expect(hex.getAttribute('class')).toContain('target-legal');
    expect(hex.getAttribute('class')).toContain('target-over');
    release();
    expect(game().actionPhase?.tactical?.system).toBe(system);
    expect(useCarryStore.getState().piece).toBeNull();
  });

  it('auf ein nicht erlaubtes System fallen gelassen springt er zurück und nichts wird gesendet', () => {
    // Ein System mit eigenem Marker lässt sich nicht noch einmal aktivieren.
    const me = actionPhase((state, player) => withOwnToken(state, player, markedOf(state)));
    const refused = markedOf(game());
    expect(activatableSystems(game(), me).map(String)).not.toContain(refused);
    const before = game();
    render(<Table flyTo={vi.fn()} />);
    const hex = dragOnto(refused);
    expect(hex.hasAttribute('data-target-state')).toBe(false);
    release();
    expect(game()).toBe(before);
    expect(useCarryStore.getState().piece).toBeNull();
    expect(useCarryStore.getState().news?.kind).toBe('putBack');
  });

  it('Enter auf einem System legt den getragenen Marker dort ab', () => {
    const me = actionPhase();
    const system = String(activatableSystems(game(), me)[0]);
    render(<Table flyTo={vi.fn()} />);
    fireEvent.click(piece());
    expect(hexOf(system).getAttribute('data-target-state')).toBe('legal');
    fireEvent.keyDown(hexOf(system), { key: 'Enter' });
    expect(game().actionPhase?.tactical?.system).toBe(system);
    expect(useGameStore.getState().selected).toBeNull();
    expect(useCarryStore.getState().news?.kind).toBe('placed');
  });

  it('Kriegsführung: ein Klick auf ein System mit eigenem Marker nimmt diesen Marker, statt das System auszuwählen', () => {
    const me = actionPhase(warfareWithToken);
    const marked = markedOf(game());
    const flyTo = vi.fn();
    render(<Table flyTo={flyTo} />);
    act(() => useHandStore.getState().choose({ player: me, card: WARFARE }));
    expect(hexOf(marked).getAttribute('data-target-state')).toBe('legal');
    fireEvent.click(hexOf(marked));
    expect(useDraftStore.getState().draft?.system).toBe(marked);
    expect(useDraftStore.getState().draft?.pools.loose).toBe(1);
    expect(hexOf(marked).getAttribute('data-target-state')).toBe('chosen');
    expect(hexOf(marked).getAttribute('class')).toContain('target-chosen');
    expect(useGameStore.getState().selected).toBeNull();
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('ohne getragenen Marker wählt ein Klick das System wie bisher', () => {
    const me = actionPhase();
    const system = String(activatableSystems(game(), me)[0]);
    const before = game();
    const flyTo = vi.fn();
    render(<Table flyTo={flyTo} />);
    fireEvent.click(hexOf(system));
    expect(useGameStore.getState().selected).toBe(system);
    expect(game()).toBe(before);
    expect(flyTo).not.toHaveBeenCalled();
    fireEvent.click(hexOf(system));
    expect(flyTo).toHaveBeenCalledTimes(1);
  });

  it('klassische Ansicht: während der Kriegsführung wählt ein Klick auf ein System mit eigenem Marker das System, nichts gilt als gewählt', () => {
    useSettingsStore.setState({ tableView: false });
    const me = actionPhase(warfareWithToken);
    const marked = markedOf(game());
    render(<Table flyTo={vi.fn()} />);
    act(() => useHandStore.getState().choose({ player: me, card: WARFARE }));
    expect(hexOf(marked).hasAttribute('data-target-state')).toBe(false);
    fireEvent.click(hexOf(marked));
    expect(useGameStore.getState().selected).toBe(marked);
    expect(useDraftStore.getState().draft).toBeNull();
    expect(hexOf(marked).getAttribute('class')).not.toContain('target-chosen');
  });

  it('getragen hören Bildschirmleser an erlaubten Systemen „Hierher legen“, an anderen nicht', () => {
    const me = actionPhase((state, player) => withOwnToken(state, player, markedOf(state)));
    const system = String(activatableSystems(game(), me)[0]);
    render(<Table flyTo={vi.fn()} />);
    expect(hexOf(system).hasAttribute('aria-describedby')).toBe(false);
    fireEvent.click(piece(), { detail: 1 });
    expect(hexOf(system).getAttribute('aria-describedby')).toBe('carry-place-here');
    expect(hexOf(markedOf(game())).hasAttribute('aria-describedby')).toBe(false);
  });

  it('Kriegsführung: das gewählte System ist für Bildschirmleser das aktuelle', () => {
    const me = actionPhase(warfareWithToken);
    const marked = markedOf(game());
    render(<Table flyTo={vi.fn()} />);
    act(() => useHandStore.getState().choose({ player: me, card: WARFARE }));
    fireEvent.click(hexOf(marked));
    expect(hexOf(marked).getAttribute('aria-current')).toBe('true');
  });
});
