// @vitest-environment jsdom
import { evolveGame, type GameState, type PlayerId } from '@stellar/domain';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../src/game-store.ts';
import { rackOf, sheetChanges, sheetModel, supplyText } from '../src/hud/sheet-model.ts';
import { zoneCounts } from '../src/hud/token-ledger.ts';
import { useSheetModel, useSheetPulse } from '../src/hud/use-sheet.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content } from '../src/store.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

beforeEach(() => useSettingsStore.setState({ animations: false }));
afterEach(() => {
  cleanup();
  leaveTable();
});

const game = () => useGameStore.getState().game as GameState;
const firstPlayer = (state: GameState): PlayerId => state.players[0]?.id as PlayerId;
const modelOf = (state: GameState, player: PlayerId) => {
  const model = sheetModel(state, player, content);
  if (model === null) throw new Error('kein Pult');
  return model;
};
const homeOf = (state: GameState, player: PlayerId) => {
  const home = Object.values(state.systems).find((system) =>
    system.spaceUnits.some((unit) => unit.owner === player),
  );
  if (home === undefined) throw new Error('kein Heimatsystem');
  return home.id;
};

/** Der Spieler am Zug aktiviert sein Heimatsystem; liefert ihn zurück. */
function activateHome(): PlayerId {
  const state = pickAll(started());
  const actor = useGameStore.getState().me as PlayerId;
  useGameStore
    .getState()
    .send({ type: 'ActivateSystem', issuedBy: actor, system: homeOf(state, actor) });
  return actor;
}

describe('Kommandopult: Daten', () => {
  it('zu Beginn: Pools 3/3/2, Nachschub 8, nichts auf der Karte', () => {
    const state = started();
    const model = modelOf(state, firstPlayer(state));
    expect(model.summary.pools).toEqual({ tactic: 3, fleet: 3, strategy: 2 });
    expect(model.reinforcements).toBe(8);
    expect(model.onBoard).toBe(0);
    expect(model.seat).toBe(1);
    expect(model.victoryGoal).toBe(10);
    expect(zoneCounts(model)).toEqual({
      reinforcements: 8,
      tactic: 3,
      fleet: 3,
      strategy: 2,
      board: 0,
    });
  });

  it('nach der Aktivierung liegt ein Marker auf der Karte', () => {
    const actor = activateHome();
    const model = modelOf(game(), actor);
    expect(model.onBoard).toBe(1);
    expect(model.summary.pools.tactic).toBe(2);
    expect(zoneCounts(model).board).toBe(1);
  });

  it('Leisten zeigen belegte und freie Fassungen samt Überlauf', () => {
    expect(rackOf(3)).toEqual({ filled: 3, empty: 1, overflow: 0 });
    expect(rackOf(10)).toEqual({ filled: 8, empty: 0, overflow: 2 });
    expect(rackOf(2, 5, 6)).toEqual({ filled: 2, empty: 3, overflow: 0 });
    expect(supplyText({ ready: 3, total: 5 })).toBe('3/5');
  });

  it('Rohstoffe auffüllen zählt vom Stand davor', () => {
    const before = started();
    const player = firstPlayer(before);
    const after = evolveGame(before, { type: 'CommoditiesReplenished', player });
    const limit = modelOf(after, player).summary.commodities.total;
    expect(limit).toBeGreaterThan(0);
    expect(sheetChanges(modelOf(before, player), modelOf(after, player))).toEqual({
      commodities: limit,
    });
    expect(sheetChanges(modelOf(after, player), modelOf(after, player))).toEqual({});
  });

  it('ohne Zuschauer kein Pult', () => {
    const state = started();
    expect(sheetModel(state, 'niemand' as PlayerId, content)).toBeNull();
    expect(zoneCounts(null)).toEqual({
      reinforcements: 0,
      tactic: 0,
      fleet: 0,
      strategy: 0,
      board: 0,
    });
    const { result } = renderHook(() => useSheetModel(state));
    expect(result.current).toBeNull();
  });
});

describe('Kommandopult: Änderungen nach dem Zug', () => {
  it('ohne Animationen bleibt die Anzeige ruhig', () => {
    const actor = activateHome();
    const { result } = renderHook(() => useSheetPulse(sheetModel(game(), actor, content)));
    expect(result.current).toEqual({ serial: 0, changes: {} });
  });

  it('mit Animationen zeigt der Zug den abgegebenen Taktikmarker', () => {
    useSettingsStore.setState({ animations: true });
    seatTable(pickAll(started()));
    const actor = useGameStore.getState().me as PlayerId;
    const { result } = renderHook(() => useSheetPulse(useSheetModel(game())));
    act(() => {
      useGameStore
        .getState()
        .send({ type: 'ActivateSystem', issuedBy: actor, system: homeOf(game(), actor) });
    });
    expect(result.current.changes).toEqual({ tactic: -1 });
    expect(result.current.serial).toBe(useGameStore.getState().lastEvents?.serial);
  });
});
