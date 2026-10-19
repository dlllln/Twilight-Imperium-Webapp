// @vitest-environment jsdom
import {
  type GameState,
  type PlayerId,
  type SystemId,
  type TacticalStep,
  technologyId,
  unitId,
  unitTypeId,
  updatePlayer,
} from '@stellar/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChosenActions } from '../src/components/map/HexTargets.tsx';
import { useGameStore } from '../src/game-store.ts';
import { systemActions } from '../src/hud/system-actions.ts';
import { FLAT_VIEW } from '../src/render/board-view.ts';
import { gameScene, type SceneHex } from '../src/render/scene-model.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, DEFAULT_VIEWPORT, useGalaxyStore } from '../src/store.ts';
import { installDomPolyfills } from './dom-polyfills.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

installDomPolyfills();

const BOUNDS = { minX: -1000, minY: -1000, width: 2000, height: 2000 };
const BAND = { top: 0, bottom: 2000 };
const SCANNER = technologyId('deep-space-scanner');

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
});

afterEach(() => {
  cleanup();
  leaveTable();
});

/**
 * Der Aktive hat ein Schiff im System mit Grenzmarker und die Technologie zum Erkunden; seine
 * taktische Aktion dort steht bei `step`.
 */
function frontierAt(step: TacticalStep): { readonly actor: PlayerId; readonly system: SystemId } {
  const base = pickAll(started());
  const actor = base.actionPhase?.active as PlayerId;
  const system = base.exploration.frontierTokens[0] as SystemId;
  const state = updatePlayer(base, actor, (player) => ({
    ...player,
    technologies: [...player.technologies, SCANNER],
  }));
  const tile = state.systems[system] as GameState['systems'][string];
  const ship = { id: unitId('kreuzer'), type: unitTypeId('cruiser'), owner: actor, damaged: false };
  const tactical = { system, step, pendingHits: [], combat: null, windows: [], bonuses: [] };
  const game: GameState = {
    ...state,
    systems: { ...state.systems, [system]: { ...tile, spaceUnits: [ship] } },
    actionPhase: state.actionPhase && { ...state.actionPhase, tactical },
  };
  seatTable(game, { me: actor });
  return { actor, system };
}

function Buttons({ onView }: { readonly onView: (hex: SceneHex) => void }): ReactElement | null {
  const state = useGameStore((store) => store.game);
  const hexes = useMemo(() => (state === null ? [] : gameScene(state, content, 'de')), [state]);
  return (
    <svg>
      <ChosenActions
        {...{ hexes, view: FLAT_VIEW, viewport: DEFAULT_VIEWPORT, bounds: BOUNDS, band: BAND }}
        onView={onView}
      />
    </svg>
  );
}

const game = () => useGameStore.getState().game as GameState;
const explore = () => screen.queryByRole('button', { name: 'Grenzmarker erkunden' });

describe('Grenzmarker erkunden über dem aktivierten System', () => {
  it('Grenzmarker erkunden erscheint nur am Ende der taktischen Aktion über dem aktivierten System und nur in der Tischansicht', () => {
    const { actor, system } = frontierAt('done');
    const other = Object.keys(game().systems).find((id) => id !== system) as string;
    expect(systemActions(game(), actor, system, false, true)).toContain('explore');
    expect(systemActions(game(), actor, system, false)).not.toContain('explore');
    expect(systemActions(game(), actor, other, false, true)).not.toContain('explore');
    const onView = vi.fn();
    render(<Buttons onView={onView} />);
    fireEvent.click(screen.getByRole('button', { name: 'System ansehen' }));
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ systemId: system }));
    const button = explore();
    if (button === null) throw new Error('kein Knopf zum Erkunden');
    fireEvent.click(button);
    expect(game().exploration.frontierTokens).not.toContain(system);
    expect(explore()).toBeNull();
  });

  it('vor dem Ende der taktischen Aktion und in der klassischen Ansicht gibt es den Knopf nicht', () => {
    const { actor, system } = frontierAt('movement');
    expect(systemActions(game(), actor, system, false, true)).not.toContain('explore');
    render(<Buttons onView={vi.fn()} />);
    expect(explore()).toBeNull();
    cleanup();
    frontierAt('done');
    useSettingsStore.setState({ tableView: false });
    render(<Buttons onView={vi.fn()} />);
    expect(explore()).toBeNull();
    useGameStore.setState({ selected: system });
    expect(explore()).toBeNull();
  });
});
