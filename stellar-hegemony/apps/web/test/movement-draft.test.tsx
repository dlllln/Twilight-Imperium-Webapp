// @vitest-environment jsdom
import {
  adjacentSystemIds,
  currentActor,
  gameId,
  type GameState,
  type MovementOption,
  playerId,
  systemId,
  unitId,
  unitTypeId,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { TacticalTurn } from '../src/components/game/TacticalPanel.tsx';
import { useGameStore } from '../src/game-store.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import {
  movementScope,
  moveOrders,
  stageShips,
  toggleFleet,
  useMovementDraft,
  useMovementOrders,
} from '../src/system/movement-draft.ts';
import { cargoAtOrigin, movementChoices } from '../src/tactical-view.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable } from './local-table.ts';

const option = (id: string): MovementOption => ({
  from: systemId('origin'),
  path: [systemId('target')],
  ship: { id: unitId(id), type: unitTypeId('carrier'), owner: playerId('p1'), damaged: false },
});
const first = option('first');
const second = option('second');
const third = option('third');
const cargo = unitId('cargo');

beforeEach(() => {
  leaveTable();
  useMovementDraft.setState({ scope: '', orders: {} });
  useGalaxyStore.setState({ language: 'de' });
});

afterEach(() => {
  cleanup();
  leaveTable();
});

function reachableGame(): GameState {
  const game = pickAll(started());
  const player = currentActor(game);
  const home = player === null ? null : homeSystemOf(game, player, content);
  const origin = home === null ? undefined : game.systems[home];
  if (player === null || origin === undefined) throw new Error('keine Heimat');
  for (const system of adjacentSystemIds(game.systems, origin)) {
    const next = tryCommand(game, { type: 'ActivateSystem', issuedBy: player, system });
    if (next.ok && movementChoices(next.value, content).some(({ ship }) => ship.type === 'carrier'))
      return next.value;
  }
  throw new Error('kein erreichbares Nachbarsystem');
}

describe('Gemeinsamer Bewegungsentwurf für Figuren und Checkliste', () => {
  it('zeigt abgelegte Flotten in beiden Ansichten und verhindert doppelt verladene Fracht', () => {
    const game = started();
    const scope = movementScope(game);
    const physical = renderHook(() => useMovementOrders(game));
    const checklist = renderHook(() => useMovementOrders(game));
    act(() => stageShips(scope, [first, second]));
    expect(checklist.result.current.orders).toEqual({ first: [], second: [] });
    act(() => checklist.result.current.toggleCargo(first.ship.id, cargo));
    expect(physical.result.current.orders[first.ship.id]).toEqual([cargo]);
    expect(checklist.result.current.loadedElsewhere(second.ship.id, cargo)).toBe(true);
    act(() => physical.result.current.toggleCargo(second.ship.id, cargo));
    expect(checklist.result.current.orders[second.ship.id]).toEqual([]);
    act(() => physical.result.current.toggleCargo(first.ship.id, cargo));
    act(() => checklist.result.current.toggleCargo(second.ship.id, cargo));
    expect(physical.result.current.orders).toEqual({ first: [], second: [cargo] });
    act(() => checklist.result.current.toggleShip(second.ship.id));
    expect(physical.result.current.loadedElsewhere(first.ship.id, cargo)).toBe(false);
    expect(physical.result.current.orders).toEqual({ first: [] });
  });

  it('ergänzt eine teilweise gewählte Flotte ohne vorhandene Fracht zu verlieren und entfernt danach nur diese Flotte', () => {
    const game = started();
    const scope = movementScope(game);
    const { result } = renderHook(() => useMovementOrders(game));
    act(() => stageShips(scope, [first, third]));
    act(() => result.current.toggleCargo(first.ship.id, cargo));
    act(() => toggleFleet(scope, [first, second]));
    expect(result.current.orders).toEqual({ first: [cargo], second: [], third: [] });
    act(() => stageShips(scope, [first, second]));
    expect(result.current.orders[first.ship.id]).toEqual([cargo]);
    act(() => toggleFleet(scope, [first, second]));
    expect(result.current.orders).toEqual({ third: [] });
    act(() => result.current.toggleCargo(first.ship.id, cargo));
    expect(result.current.orders).toEqual({ third: [] });
  });

  it('neue Serverversion und andere Partie verwerfen alte Schiffe samt Fracht', () => {
    const game = started();
    const { result, rerender } = renderHook(({ state }) => useMovementOrders(state), {
      initialProps: { state: game },
    });
    act(() => stageShips(movementScope(game), [first]));
    act(() => result.current.toggleCargo(first.ship.id, cargo));
    expect(result.current.orders).toEqual({ first: [cargo] });
    const updated = { ...game, version: game.version + 1 };
    rerender({ state: updated });
    expect(result.current.orders).toEqual({});
    act(() => stageShips(movementScope(updated), [second]));
    expect(result.current.orders).toEqual({ second: [] });
    rerender({ state: { ...updated, id: gameId('another-table') } });
    expect(result.current.orders).toEqual({});
  });

  it('übergibt ausschließlich aktuell zulässige Schiffe und deren aktuelle Wege', () => {
    const revised = { ...first, path: [systemId('via'), systemId('target')] };
    expect(moveOrders([revised, second], { first: [cargo], stale: [], third: [] })).toEqual([
      { ship: first.ship.id, path: revised.path, cargo: [cargo] },
    ]);
    expect(moveOrders([second], { first: [cargo] })).toEqual([]);
  });

  it('Ablegen und Frachtwahl schicken erst nach ausdrücklicher Bestätigung einen Spielbefehl', () => {
    const game = reachableGame();
    const player = currentActor(game);
    if (player === null) throw new Error('niemand am Zug');
    const carrier = movementChoices(game, content).find(({ ship }) => ship.type === 'carrier');
    if (carrier === undefined) throw new Error('kein Träger');
    const load = cargoAtOrigin(game, content, carrier, player)[0];
    if (load === undefined) throw new Error('keine Fracht');
    leaveTable();
    const command = vi.fn();
    useGameStore.getState().goOnline(player, { command, undo: () => undefined });
    useGameStore.getState().receive({ state: game, events: [] });
    const draft = renderHook(() => useMovementOrders(game));
    render(<TacticalTurn game={game} player={player} />);
    act(() => stageShips(movementScope(game), [carrier]));
    expect(screen.getByRole('button', { name: 'Schiffe bewegen' })).toBeTruthy();
    expect(command).not.toHaveBeenCalled();
    act(() => draft.result.current.toggleCargo(carrier.ship.id, load.id));
    expect(command).not.toHaveBeenCalled();
    expect(useGameStore.getState().game).toBe(game);
    fireEvent.click(screen.getByRole('button', { name: 'Schiffe bewegen' }));
    expect(command).toHaveBeenCalledExactlyOnceWith({
      type: 'MoveShips',
      issuedBy: player,
      moves: [{ ship: carrier.ship.id, path: carrier.path, cargo: [load.id] }],
    });
  });
});
