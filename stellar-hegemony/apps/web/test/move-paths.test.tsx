// @vitest-environment jsdom
import { adjacentSystemIds, currentActor, type GameState, type PlayerId } from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { FleetPieces } from '../src/components/pieces/FleetPieces.tsx';
import { awayFromRoutes, MovePaths } from '../src/components/pieces/MovePaths.tsx';
import { gameScene } from '../src/render/scene-model.ts';
import { tryCommand } from '../src/rules-preview.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { fleetPoint, type FleetProjection } from '../src/system/fleet-placement.ts';
import { useMovementDraft } from '../src/system/movement-draft.ts';
import { movementChoices } from '../src/tactical-view.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable, seatTable } from './local-table.ts';

interface Activated {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly home: string;
  readonly active: string;
}

/** Ein Nachbarsystem der Heimat ist aktiviert, Schiffe aus der Heimat können es erreichen. */
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
    if (next.ok && choices.some(({ from }) => from === home))
      return { game: next.value, player, home, active: system };
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

const paths = () => [...document.querySelectorAll<SVGPolylineElement>('polyline.move-path')];

beforeEach(() => {
  leaveTable();
  useMovementDraft.setState({ scope: '', orders: {} });
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ animations: true });
});

afterEach(() => {
  cleanup();
  leaveTable();
});

/** Der erste Weg endet mit einer Pfeilspitze (SVG-Marker). */
function expectArrowHead(): void {
  const [path] = paths();
  const marker = path?.getAttribute('marker-end')?.match(/^url\(#(.+)\)$/)?.[1] ?? '';
  expect(document.getElementById(marker)?.tagName.toLowerCase()).toBe('marker');
}

/** Die Vorschau ist abgerückt und steht an `at` (Bildschirmpixel). */
function expectStagedAt(at: { readonly x: number; readonly y: number }): void {
  const box = document.querySelector<HTMLElement>('.fleet-staged');
  expect(box?.dataset['away']).toBe('true');
  expect(Number.parseFloat(box?.style.left ?? '')).toBeCloseTo(at.x);
  expect(Number.parseFloat(box?.style.top ?? '')).toBeCloseTo(at.y);
}

describe('Wege der vorgemerkten Schiffe auf der Karte', () => {
  it('abgelegte Schiffe zeigen ihren Weg gestrichelt bis ins aktivierte System', () => {
    const { game, home, active } = activated();
    const frame = frameOf(game);
    seatTable(game);
    render(<FleetPieces {...frame} />);
    expect(paths()).toHaveLength(0);
    fireEvent.click(
      screen.getByRole('button', { name: `Flotte aus ${home.toUpperCase()} aufnehmen` }),
    );
    const fromHome = movementChoices(game, content).filter(({ from }) => from === home);
    const [path] = paths();
    if (path === undefined) throw new Error('kein Weg');
    expect(path.getAttribute('data-from')).toBe(home);
    expect(Number(path.getAttribute('data-count'))).toBe(fromHome.length);
    const target = fleetPoint(frame, active);
    expect(path.getAttribute('points')?.split(' ').at(-1)).toBe(`${target?.x},${target?.y}`);
    const svg = path.closest('svg.move-paths');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('data-motion')).toBe('true');
    act(() => useSettingsStore.setState({ animations: false }));
    expect(svg?.getAttribute('data-motion')).toBe('false');
  });

  it('die Vorschau rückt weg von den Wegen, deren Enden eine Pfeilspitze tragen', () => {
    const { game, home, active } = activated();
    const frame = frameOf(game);
    seatTable(game);
    render(<FleetPieces {...frame} />);
    fireEvent.click(
      screen.getByRole('button', { name: `Flotte aus ${home.toUpperCase()} aufnehmen` }),
    );
    expectArrowHead();
    const staged = movementChoices(game, content).filter(({ from }) => from === home);
    const away = awayFromRoutes(frame, staged, active);
    const target = fleetPoint(frame, active);
    const start = fleetPoint(frame, home);
    if (away === null || target === null || start === null) throw new Error('keine Richtung');
    expect(Math.hypot(away.x, away.y)).toBeCloseTo(1);
    const inward = { x: target.x - start.x, y: target.y - start.y };
    expect(away.x * inward.x + away.y * inward.y).toBeGreaterThan(0);
    expectStagedAt({ x: target.x + away.x * 30, y: target.y + away.y * 30 });
    expect(awayFromRoutes(frame, [], active)).toBeNull();
  });

  it('ohne abgelegte Schiffe gibt es weder Wege noch den Knopf Fracht laden', () => {
    const { game, home } = activated();
    const frame = frameOf(game);
    seatTable(game);
    render(<FleetPieces {...frame} />);
    expect(document.querySelector('.move-paths')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fracht laden' })).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: `Flotte aus ${home.toUpperCase()} aufnehmen` }),
    );
    expect(paths()).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Flottenauswahl zurücksetzen' }));
    expect(document.querySelector('.move-paths')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fracht laden' })).toBeNull();
    const options = movementChoices(game, content);
    const staged = Object.fromEntries(options.map(({ ship }) => [ship.id, []]));
    const elsewhere = { ...frame, hexes: frame.hexes.filter((hex) => hex.systemId !== home) };
    render(<MovePaths frame={elsewhere} options={options} orders={staged} />);
    expect(document.querySelector(`[data-from="${home}"]`)).toBeNull();
  });
});
