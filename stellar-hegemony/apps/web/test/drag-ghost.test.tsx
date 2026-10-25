// @vitest-environment jsdom
import { type GameState, type PlayerId, updatePlayer } from '@stellar/domain';
import { act, cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unitArtwork } from '../src/artwork/units.ts';
import { NoticeStack } from '../src/components/hud/NoticeStack.tsx';
import { DragGhost } from '../src/components/table/DragGhost.tsx';
import { useGameStore } from '../src/game-store.ts';
import { useHandStore } from '../src/hand/hand-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { useCarryStore } from '../src/table/carry-store.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import {
  CRATE_PIECE,
  poolTarget,
  SOCKET,
  type TargetRef,
  targetKey,
  yardPiece,
} from '../src/table/target-ref.ts';
import { cardOf } from './card-form-helpers.tsx';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

/*
 * Der Geist am Zeiger: Einheiten aus der Werft zeigen ihr Bild, Rohstoffe eine Kiste. Über dem
 * Sockel der Sekundärfähigkeit bleibt der getragene Marker sichtbar, statt in einem gleich großen
 * Marker im Sockel aufzugehen.
 */

const EMPTY = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };

beforeEach(() => {
  leaveTable();
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: false, tableView: true });
  useCarryStore.setState({ ...EMPTY, news: null });
  useHandStore.getState().clear();
  useDraftStore.getState().clear();
});

afterEach(cleanup);

const ghost = () => document.querySelector('.drag-ghost');

/** Nimmt ein Stück per Ziehen auf und führt es an eine Stelle, optional über ein Ziel. */
function drag(piece: TargetRef, over: TargetRef | null = null): void {
  const legal = new Set(over === null ? [] : [targetKey(over)]);
  act(() => {
    useCarryStore.getState().pickUp(piece, legal, 'drag');
    useCarryStore.getState().track({ x: 40, y: 50 }, over === null ? null : targetKey(over));
  });
}

/** Der Aktive sitzt am Bildschirm; seine Platznummer bestimmt die Farbe der Bilder. */
function seated(): GameState {
  const state = pickAll(started());
  seatTable(state, { me: state.actionPhase?.active as PlayerId });
  return state;
}

/** Ein Mitspieler folgt der Politik; er sitzt am Bildschirm und hat Strategiemarker. */
function following(): void {
  const state = pickAll(started());
  const turn = state.actionPhase as NonNullable<GameState['actionPhase']>;
  const me = state.players.find((player) => player.id !== turn.active)?.id as PlayerId;
  const secondary = { card: cardOf('politics').id, awaiting: [me], free: [] };
  const open = { ...state, actionPhase: { ...turn, secondary } };
  seatTable(
    updatePlayer(open, me, (p) => ({ ...p, commandPools: { ...p.commandPools, strategy: 2 } })),
    { me },
  );
}

function Prompt(): ReactElement | null {
  const current = useGameStore((state) => state.game);
  return current === null ? null : <NoticeStack game={current} />;
}

describe('Geist am Zeiger', () => {
  it('ein Stück aus der Werft zeigt im Geist das Bild der Einheit', () => {
    const state = seated();
    const me = state.players.find((player) => player.id === useGameStore.getState().me);
    render(<DragGhost faction="test" seat="#E69F00" />);
    drag(yardPiece('infantry'));
    expect(ghost()?.getAttribute('data-material')).toBe('unit');
    const own = unitArtwork('infantry', (me?.seat ?? 0) + 1);
    expect(own).toMatch(/_gf\.png$/);
    expect(ghost()?.querySelector('img')?.getAttribute('src')).toBe(own);
    expect(ghost()?.querySelector('.sheet-token')).toBeNull();
  });

  it('ein getragener Rohstoff zeigt eine Kiste', () => {
    seated();
    render(<DragGhost faction="test" seat="#E69F00" />);
    drag(CRATE_PIECE);
    expect(ghost()?.getAttribute('data-material')).toBe('crate');
    expect(ghost()?.querySelector('.crate-svg')).not.toBeNull();
    expect(ghost()?.querySelector('.coin-svg')).toBeNull();
    expect(ghost()?.classList.contains('coin')).toBe(false);
  });

  it('über dem Sockel bleibt der Geist der einzige Marker, der Sockel öffnet sein Bett', () => {
    following();
    render(
      <>
        <Prompt />
        <DragGhost faction="test" seat="#E69F00" />
      </>,
    );
    const socket = () => document.querySelector(`[data-target="${targetKey(SOCKET)}"]`);
    expect(socket()?.querySelector('.socket-bed')).toBeNull();
    drag(poolTarget('strategy'), SOCKET);
    expect(socket()?.getAttribute('data-over')).toBe('true');
    expect(socket()?.querySelector('.socket-bed')).not.toBeNull();
    expect(socket()?.querySelector('.socket-token')).toBeNull();
    expect(ghost()?.getAttribute('data-over')).toBe('true');
    expect(ghost()?.querySelector('.sheet-token, svg')).not.toBeNull();
  });
});
