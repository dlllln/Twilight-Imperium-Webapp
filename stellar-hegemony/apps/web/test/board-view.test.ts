import { describe, expect, it } from 'vitest';
import { hexToPixel } from '../src/hex-geometry.ts';
import { boardEdges } from '../src/render/board-grid.ts';
import {
  blendView,
  boardBounds,
  clampTilt,
  FLAT_VIEW,
  MAX_TILT,
  MIN_TILT,
  lift,
  project,
  turn,
  viewFrom,
} from '../src/render/board-view.ts';
import { hueRotate, planetStyle } from '../src/render/planet-style.ts';
import { viewerSeat } from '../src/system/board-camera.ts';
import { started } from './game-helpers.ts';

const HOME = hexToPixel({ q: 0, r: -3 });

describe('Schräger Blick auf das Brett', () => {
  it('das eigene Heimatsystem liegt vorne unten, egal wo es auf der Karte liegt', () => {
    for (const home of [HOME, hexToPixel({ q: 3, r: 0 }), hexToPixel({ q: -3, r: 3 })]) {
      const turned = turn(viewFrom(home), home);
      expect(turned.x).toBeCloseTo(0);
      expect(turned.y).toBeCloseTo(Math.hypot(home.x, home.y));
    }
    expect(viewFrom(null)).toEqual(FLAT_VIEW);
  });

  it('vorne ist größer als hinten, und die Fläche erscheint gestaucht (keine Vogelperspektive)', () => {
    const near = lift({ x: 0, y: 200 });
    const far = lift({ x: 0, y: -200 });
    expect(near.scale).toBeGreaterThan(1);
    expect(far.scale).toBeLessThan(1);
    expect(near.y - far.y).toBeLessThan(400 * 0.8);
    expect(lift({ x: 0, y: 0 }, 10).y).toBeLessThan(0);
  });

  it('das Brett dreht sich beim Platzwechsel über den kürzeren Weg', () => {
    const from = { angle: Math.PI * 0.9, tilt: 0.5 };
    const to = { angle: -Math.PI * 0.9, tilt: 0.9 };
    const middle = blendView(from, to, 0.5);
    expect(Math.abs(Math.cos(middle.angle) + 1)).toBeLessThan(1e-9);
    expect(blendView(from, to, 1).angle).toBeCloseTo(from.angle + Math.PI * 0.2);
    expect(middle.tilt).toBeCloseTo(0.7);
  });

  it('in der Draufsicht erscheint das Brett ungestaucht, bei starker Neigung flacher', () => {
    const top = { ...FLAT_VIEW, tilt: MIN_TILT };
    const steep = { ...FLAT_VIEW, tilt: MAX_TILT };
    const height = (view: typeof top) =>
      project(view, { x: 0, y: 100 }).y - project(view, { x: 0, y: -100 }).y;
    expect(height(top)).toBeCloseTo(200, 0);
    expect(height(steep)).toBeLessThan(height(FLAT_VIEW));
    expect(clampTilt(MAX_TILT + 1)).toBe(MAX_TILT);
    expect(clampTilt(-1)).toBe(MIN_TILT);
  });

  it('der Bildausschnitt umfasst das ganze Brett samt Brettkante', () => {
    const centers = [{ x: 0, y: 0 }, HOME, hexToPixel({ q: 3, r: 0 })];
    const view = viewFrom(HOME);
    const bounds = boardBounds(view, centers);
    for (const center of centers) {
      const point = project(view, center);
      expect(point.x).toBeGreaterThan(bounds.minX);
      expect(point.y).toBeLessThan(bounds.minY + bounds.height);
    }
  });

  it('gemeinsame Kanten werden nur einmal gezeichnet; außen liegt der Rand', () => {
    const pair = boardEdges([hexToPixel({ q: 0, r: 0 }), hexToPixel({ q: 0, r: 1 })]);
    expect(pair).toHaveLength(11);
    expect(pair.filter((edge) => !edge.outer)).toHaveLength(1);
  });

  it('jeder sieht die Karte von seinem eigenen Platz aus (Plätze ab 1), vor der Partie von Platz 1', () => {
    const game = started();
    expect(viewerSeat(null, null)).toBe(1);
    expect(viewerSeat(game, null)).toBe(1);
    for (const player of game.players) expect(viewerSeat(game, player.id)).toBe(player.seat + 1);
  });
});

describe('Individuelle Planeten', () => {
  const ids = Array.from({ length: 40 }, (_, index) => `welt-${String(index)}`);

  it('derselbe Planet sieht immer gleich aus, verschiedene Planeten verschieden', () => {
    expect(planetStyle('aurelis', 'industrial')).toEqual(planetStyle('aurelis', 'industrial'));
    const shapes = new Set(ids.map((id) => JSON.stringify(planetStyle(id, 'cultural'))));
    expect(shapes.size).toBe(ids.length);
  });

  it('es gibt Ozeanwelten, Eiswelten, Kraterwelten, Gasriesen und Ringe', () => {
    const styles = ids.flatMap((id) =>
      (['cultural', 'industrial', 'hazardous', 'plain'] as const).map((look) =>
        planetStyle(id, look),
      ),
    );
    expect(styles.some((style) => style.ocean > 0.5)).toBe(true);
    expect(styles.some((style) => style.ice >= 0.9)).toBe(true);
    expect(styles.some((style) => style.craters >= 0.8)).toBe(true);
    expect(styles.some((style) => style.bands === 1)).toBe(true);
    expect(styles.some((style) => style.ring === 1)).toBe(true);
    for (const style of styles) expect(Math.abs(style.size - 1)).toBeLessThanOrEqual(0.12);
  });

  it('der Farbton schwankt nur leicht, damit die Art erkennbar bleibt', () => {
    expect(hueRotate([200, 60, 40], 0).map(Math.round)).toEqual([200, 60, 40]);
    for (const id of ids)
      expect(Math.abs(planetStyle(id, 'hazardous').hue)).toBeLessThanOrEqual(16);
    const [red, , blue] = hueRotate([200, 60, 40], 16);
    expect(red).toBeGreaterThan(blue);
  });
});
