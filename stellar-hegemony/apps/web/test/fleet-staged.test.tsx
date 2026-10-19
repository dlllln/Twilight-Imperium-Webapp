// @vitest-environment jsdom
import {
  adjacentSystemIds,
  currentActor,
  type GameState,
  type PlayerId,
  unitTypeId,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { TacticalTurn } from '../src/components/game/TacticalPanel.tsx';
import { FleetPieces } from '../src/components/pieces/FleetPieces.tsx';
import { useGameStore } from '../src/game-store.ts';
import { gameScene } from '../src/render/scene-model.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import type { FleetProjection } from '../src/system/fleet-placement.ts';
import {
  movementScope,
  moveOrders,
  stageShips,
  useMovementDraft,
} from '../src/system/movement-draft.ts';
import { moveSummary } from '../src/table/move-draft.ts';
import { cargoAtOrigin, movementChoices } from '../src/tactical-view.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable } from './local-table.ts';

interface Activated {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly home: string;
}

/** Ein Nachbarsystem der Heimat ist aktiviert, ein Träger aus der Heimat kann es erreichen. */
function homeOf(game: GameState) {
  const player = currentActor(game);
  const home = player === null ? null : homeSystemOf(game, player, content);
  const origin = home === null ? undefined : game.systems[home];
  if (player === null || home === null || origin === undefined) throw new Error('keine Heimat');
  return { player, home, origin };
}

function activated(): Activated {
  const game = pickAll(started());
  const { player, home, origin } = homeOf(game);
  for (const system of adjacentSystemIds(game.systems, origin)) {
    const next = tryCommand(game, { type: 'ActivateSystem', issuedBy: player, system });
    const choices = next.ok ? movementChoices(next.value, content) : [];
    if (next.ok && choices.some(({ ship, from }) => from === home && ship.type === 'carrier'))
      return { game: next.value, player, home };
  }
  throw new Error('kein erreichbares Nachbarsystem');
}

const frameOf = (game: GameState): FleetProjection => ({
  hexes: gameScene(game, content, 'de'),
  bounds: { minX: -1200, minY: -1200, width: 2400, height: 2400 },
  viewport: { zoom: 1, panX: 0, panY: 0 },
  view: { angle: 0, tilt: 0 },
  size: { width: 1200, height: 900 },
});

/** Karte mit Figuren und die zugängliche Checkliste, online mit einem beobachteten Server. */
function seatBoth({ game, player }: Activated) {
  const command = vi.fn();
  useGameStore.getState().goOnline(player, { command, undo: () => undefined });
  useGameStore.getState().receive({ state: game, events: [] });
  render(
    <>
      <FleetPieces {...frameOf(game)} />
      <TacticalTurn game={game} player={player} />
    </>,
  );
  return command;
}

const orders = () => useMovementDraft.getState().orders;
const pickUp = (home: string) =>
  fireEvent.click(
    screen.getByRole('button', { name: `Flotte aus ${home.toUpperCase()} aufnehmen` }),
  );
const checkedCargo = () => document.querySelectorAll('.cargo input:checked').length;

beforeEach(() => {
  leaveTable();
  useMovementDraft.setState({ scope: '', orders: {} });
  useGalaxyStore.setState({ language: 'de' });
});

afterEach(() => {
  cleanup();
  leaveTable();
});

describe('Vorschau im aktivierten System und Messleiste der Checkliste', () => {
  it('Fracht laden belädt Vorschau und Checkliste zugleich, ohne eine Einheit doppelt zu verladen', () => {
    const table = activated();
    seatBoth(table);
    pickUp(table.home);
    expect(checkedCargo()).toBe(0);
    const load = screen.getByRole('button', { name: 'Fracht laden' });
    load.focus();
    fireEvent.click(load, { detail: 0 });
    const loaded = Object.values(orders()).flat();
    expect(loaded.length).toBeGreaterThan(0);
    expect(new Set(loaded).size).toBe(loaded.length);
    for (const unit of loaded) expect(orders()[unit]).toBeUndefined();
    expect(checkedCargo()).toBe(loaded.length);
    const text = `Schiffe ${String(Object.keys(orders()).length)} · Fracht ${String(loaded.length)}`;
    expect(screen.getByTestId('staged-summary').textContent).toBe(text);
    expect(screen.getByTestId('move-summary').textContent).toBe(text);
    const summary = screen.getByTestId('staged-summary');
    expect(summary.getAttribute('aria-live')).toBe('polite');
    expect(summary.getAttribute('aria-atomic')).toBe('true');
    const spent = screen.getByRole('button', { name: 'Fracht laden' });
    expect(spent.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(spent);
    fireEvent.click(spent, { detail: 0 });
    expect(Object.values(orders()).flat()).toEqual(loaded);
  });

  it('Zurücknehmen per Tastatur: der Fokus bleibt in der Vorschau oder geht an den Griff der Flotte', () => {
    const table = activated();
    seatBoth(table);
    pickUp(table.home);
    const unstage = () => screen.queryAllByRole('button', { name: /zurücknehmen$/ });
    for (let left = unstage().length * 10; left > 0 && unstage().length > 0; left -= 1) {
      const button = unstage()[0] as HTMLElement;
      button.focus();
      fireEvent.click(button, { detail: 0 });
      const focused = document.activeElement;
      expect(focused).not.toBe(document.body);
      expect(focused?.matches('.fleet-unstage, .fleet-pickup')).toBe(true);
    }
    expect(document.querySelector('.fleet-staged')).toBeNull();
    const handle = `Flotte aus ${table.home.toUpperCase()} aufnehmen`;
    expect(document.activeElement).toBe(screen.getByRole('button', { name: handle }));
  });

  it('ein Schiffstyp lässt sich in der Vorschau einzeln zurücknehmen', () => {
    const table = activated();
    seatBoth(table);
    pickUp(table.home);
    const carriers = () =>
      movementChoices(table.game, content).filter(
        ({ ship }) => ship.type === 'carrier' && orders()[ship.id] !== undefined,
      ).length;
    const before = { ships: Object.keys(orders()).length, carriers: carriers() };
    fireEvent.click(screen.getByRole('button', { name: 'Träger zurücknehmen' }));
    expect(carriers()).toBe(before.carriers - 1);
    expect(Object.keys(orders())).toHaveLength(before.ships - 1);
    expect(document.querySelector('.fleet-staged')?.textContent).toContain('Vorschau');
    const unchecked = document.querySelectorAll('.ship-choices > li > label > input:not(:checked)');
    expect(unchecked).toHaveLength(1);
  });

  it('die Messleiste der Bewegung zählt Schiffe und Fracht', () => {
    const table = activated();
    seatBoth(table);
    expect(screen.queryByTestId('move-summary')).toBeNull();
    const carrier = movementChoices(table.game, content).find(
      ({ ship, from }) => from === table.home && ship.type === unitTypeId('carrier'),
    );
    if (carrier === undefined) throw new Error('kein Träger');
    act(() => stageShips(movementScope(table.game), [carrier]));
    const meter = screen.getByTestId('move-summary');
    expect(meter.getAttribute('aria-live')).toBe('polite');
    expect(meter.closest('.ship-choices')).toBeNull();
    expect(meter.textContent).toBe('Schiffe 1 · Fracht 0');
    const load = cargoAtOrigin(table.game, content, carrier, table.player)[0];
    if (load === undefined) throw new Error('keine Fracht');
    const box = screen.getAllByRole('checkbox').find((input) => input.closest('.cargo') !== null);
    if (box === undefined) throw new Error('keine Frachtwahl');
    fireEvent.click(box);
    expect(screen.getByTestId('move-summary').textContent).toBe('Schiffe 1 · Fracht 1');
  });

  it('erst Schiffe bewegen schickt einen Befehl', () => {
    const table = activated();
    const command = seatBoth(table);
    pickUp(table.home);
    fireEvent.click(screen.getByRole('button', { name: 'Fracht laden' }));
    fireEvent.click(screen.getByRole('button', { name: 'Träger zurücknehmen' }));
    expect(command).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: 'Schiffe bewegen' })).toHaveLength(1);
    const moves = moveOrders(movementChoices(table.game, content), orders());
    expect(moveSummary(orders()).ships).toBe(moves.length);
    fireEvent.click(screen.getByRole('button', { name: 'Schiffe bewegen' }));
    expect(command).toHaveBeenCalledExactlyOnceWith({
      type: 'MoveShips',
      issuedBy: table.player,
      moves,
    });
    const move = { type: 'MoveShips', issuedBy: table.player, moves } as const;
    expect(tryCommand(table.game, move).ok).toBe(true);
  });
});
