// @vitest-environment jsdom
import { type PlayerId, strategyCardId, type StrategyCardState } from '@stellar/domain';
import { act, cleanup, render } from '@testing-library/react';
import { type ReactElement, useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ghostSize, TokenGhosts } from '../src/components/map/TokenGhosts.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { FLAT_VIEW } from '../src/render/board-view.ts';
import { gameScene } from '../src/render/scene-model.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

installDomPolyfills();

const BOUNDS = { minX: -1000, minY: -1000, width: 2000, height: 2000 };
const SIZE = { width: 1000, height: 800 };
const EMBASSY = strategyCardId('embassy');

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  useDraftStore.getState().clear();
  useHandStore.getState().clear();
});

afterEach(() => {
  cleanup();
  leaveTable();
});

/** Der Aktive hält die Diplomatie und hat sie aus der Hand gewählt. */
function diplomacy(): void {
  const state = pickAll(started());
  const actor = state.actionPhase?.active as PlayerId;
  const card = { ...(state.strategyCards[EMBASSY] as StrategyCardState), holder: actor };
  seatTable(
    { ...state, strategyCards: { ...state.strategyCards, [EMBASSY]: card } },
    { me: actor },
  );
  act(() => useHandStore.getState().choose({ player: actor, card: EMBASSY }));
}

/** Nur die Geister, bei diesem Zoom der Kamera. */
function Ghosts({ zoom }: { readonly zoom: number }): ReactElement {
  const state = useGameStore((store) => store.game);
  const hexes = useMemo(() => (state === null ? [] : gameScene(state, content, 'de')), [state]);
  const viewport = { zoom, panX: 0, panY: 0 };
  return (
    <TokenGhosts hexes={hexes} view={FLAT_VIEW} viewport={viewport} bounds={BOUNDS} size={SIZE} />
  );
}

interface Measured {
  readonly size: number;
  readonly left: number;
}

const measured = (): Measured[] =>
  [...document.querySelectorAll<HTMLElement>('.token-ghost')].map((ghost) => ({
    size: Number.parseFloat(ghost.style.getPropertyValue('--ghost-size')),
    left: Number.parseFloat(ghost.style.left),
  }));

/** Größe der Geister bei diesem Zoom; alle Geister eines Systems sind gleich groß. */
function sizeAt(zoom: number, rerender: (ui: ReactElement) => void): number {
  rerender(<Ghosts zoom={zoom} />);
  const ghosts = measured();
  expect(ghosts.length).toBeGreaterThan(1);
  const [first, second] = ghosts as [Measured, Measured];
  expect(second.size).toBe(first.size);
  expect(Math.abs(second.left - first.left)).toBeGreaterThanOrEqual(first.size);
  return first.size;
}

describe('Markergeister auf der Karte', () => {
  it('Geister wachsen mit dem Feld und bleiben mindestens 40 Pixel groß', () => {
    diplomacy();
    const { rerender } = render(<Ghosts zoom={0.5} />);
    const far = sizeAt(0.5, rerender);
    const near = sizeAt(3, rerender);
    const close = sizeAt(8, rerender);
    expect(far).toBe(40);
    expect(near).toBeGreaterThan(far);
    expect(close).toBeGreaterThan(near);
    expect(close).toBe(76);
    expect(ghostSize(0)).toBe(40);
    expect(ghostSize(1000)).toBe(76);
    const emblem = document.querySelector('.token-ghost svg, .token-ghost img');
    expect(emblem).not.toBeNull();
  });
});
