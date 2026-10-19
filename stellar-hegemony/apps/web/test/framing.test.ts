import { adjacentSystemIds, type GameState, type PlayerId, type SystemId } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { homeSystemOf } from '../src/card-view.ts';
import { type Bounds, hexToPixel, type Point } from '../src/hex-geometry.ts';
import { boardBounds, FLAT_VIEW, projectedCorners } from '../src/render/board-view.ts';
import { gameScene } from '../src/render/scene-model.ts';
import { content, type Viewport } from '../src/store.ts';
import { framingViewport } from '../src/system/framing.ts';
import { FOCUS_ZOOM } from '../src/system/viewport-tween.ts';
import { framingOf } from '../src/table/camera-intent.ts';
import { decisionOf } from '../src/table/decision-route.ts';
import { pickAll, started } from './game-helpers.ts';

/** Ein Nachbarsystem der Heimat ist aktiviert; die Schiffe der Heimat können hinein. */
function moving(): { readonly game: GameState; readonly actor: PlayerId; readonly home: SystemId } {
  const state = pickAll(started());
  const actor = state.actionPhase?.active as PlayerId;
  const home = homeSystemOf(state, actor, content) as SystemId;
  const tile = state.systems[home] as GameState['systems'][string];
  const target = adjacentSystemIds(state.systems, tile).find(
    (id) => state.systems[id]?.anomaly === undefined,
  ) as SystemId;
  const tactical = {
    system: target,
    step: 'movement' as const,
    pendingHits: [],
    combat: null,
    windows: [],
    bonuses: [],
  };
  const game = { ...state, actionPhase: state.actionPhase && { ...state.actionPhase, tactical } };
  return { game, actor, home };
}

describe('Kamera: Aktion ins Bild', () => {
  it('Aktion ins Bild rahmt das aktive System und die Herkunftssysteme', () => {
    const { game, actor, home } = moving();
    const route = decisionOf({ game, actor, waitingOn: null, chosen: null });
    const systems = framingOf(game, route, new Map());
    const active = game.actionPhase?.tactical?.system as SystemId;
    expect(systems).toContain(active);
    expect(systems).toContain(home);

    const hexes = gameScene(game, content, 'de');
    const bounds = boardBounds(
      FLAT_VIEW,
      hexes.map((hex) => hexToPixel(hex.position)),
    );
    const area = { bounds, free: bounds, size: { width: 1000, height: 800 } };
    const viewport = framingViewport(area, FLAT_VIEW, hexes, systems);
    if (viewport === null) throw new Error('keine Rahmung');
    expect(viewport.zoom).toBeGreaterThan(1);
    expect(viewport.zoom).toBeLessThanOrEqual(FOCUS_ZOOM);
    expectInside(viewport, framedCorners(hexes, systems), bounds);
    expect(framingViewport(area, FLAT_VIEW, hexes, [])).toBeNull();
  });
});

/** Ecken der Felder dieser Systeme in Brettkoordinaten. */
function framedCorners(hexes: ReturnType<typeof gameScene>, systems: readonly SystemId[]) {
  return hexes
    .filter((hex) => systems.includes(hex.systemId as SystemId))
    .flatMap((hex) => projectedCorners(FLAT_VIEW, hexToPixel(hex.position)));
}

/** Alle Punkte stehen in der Ansicht innerhalb des Bereichs `area` (viewBox). */
function expectInside(viewport: Viewport, corners: readonly Point[], area: Bounds): void {
  for (const corner of corners) {
    const x = viewport.panX + corner.x * viewport.zoom;
    const y = viewport.panY + corner.y * viewport.zoom;
    expect(x).toBeGreaterThanOrEqual(area.minX);
    expect(x).toBeLessThanOrEqual(area.minX + area.width);
    expect(y).toBeGreaterThanOrEqual(area.minY);
    expect(y).toBeLessThanOrEqual(area.minY + area.height);
  }
}

describe('Kamera: Aktion ins Bild zwischen den Anzeigen', () => {
  it('die Systeme stehen mitten im freien Bereich, nicht hinter Ansage und Phase', () => {
    const { game, home } = moving();
    const hexes = gameScene(game, content, 'de');
    const bounds = boardBounds(
      FLAT_VIEW,
      hexes.map((hex) => hexToPixel(hex.position)),
    );
    // Unten liegt gut die Hälfte des Bildes unter Ansage, Hand und Pult.
    const free = { ...bounds, height: bounds.height * 0.45 };
    const area = { bounds, free, size: { width: 820, height: 1180 } };
    const viewport = framingViewport(area, FLAT_VIEW, hexes, [home]);
    if (viewport === null) throw new Error('keine Rahmung');
    expectInside(viewport, framedCorners(hexes, [home]), free);
    const center = framedCorners(hexes, [home]).reduce(
      (sum, corner) => ({ x: sum.x + corner.x / 6, y: sum.y + corner.y / 6 }),
      { x: 0, y: 0 },
    );
    expect(viewport.panY + center.y * viewport.zoom).toBeCloseTo(free.minY + free.height / 2, 0);
  });

  it('ein einzelnes System bleibt mit seinen Nachbarn im Bild statt bildfüllend', () => {
    const { game, home } = moving();
    const hexes = gameScene(game, content, 'de');
    const bounds = boardBounds(
      FLAT_VIEW,
      hexes.map((hex) => hexToPixel(hex.position)),
    );
    const area = { bounds, free: bounds, size: { width: 1440, height: 900 } };
    const viewport = framingViewport(area, FLAT_VIEW, hexes, [home]);
    if (viewport === null) throw new Error('keine Rahmung');
    expect(viewport.zoom).toBeLessThan(FOCUS_ZOOM);
    const corners = framedCorners(hexes, [home]);
    const width = Math.max(...corners.map((c) => c.x)) - Math.min(...corners.map((c) => c.x));
    // Das Feld nimmt höchstens ein Drittel der Bildbreite ein: Platz für den Ring der Nachbarn.
    expect(width * viewport.zoom).toBeLessThanOrEqual(bounds.width / 3 + 0.01);
  });
});
