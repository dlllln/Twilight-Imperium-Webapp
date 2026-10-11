// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CloseUpLabels } from '../src/components/CloseUpLabels.tsx';
import { boundsOf, hexToPixel } from '../src/hex-geometry.ts';
import { planetPaint } from '../src/render/planet-paint.ts';
import { gameScene, type SceneHex } from '../src/render/scene-model.ts';
import { insideHex } from '../src/render/tile-relief.ts';
import { detailLevel, lineScale, worldTransform } from '../src/render/view-transform.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { closeUpMarks } from '../src/system/close-up.ts';
import {
  blendViewport,
  CLOSE_ZOOM,
  focusViewport,
  systemZoom,
  ZOOM_MAX,
  zoomAround,
} from '../src/system/viewport-tween.ts';
import { wheelFactor } from '../src/use-pan-zoom.ts';
import { started } from './game-helpers.ts';

beforeEach(() => useGalaxyStore.setState({ language: 'de' }));
afterEach(cleanup);

const SCREEN = { width: 1600, height: 900 };

function homeScene(): { hexes: readonly SceneHex[]; home: SceneHex } {
  const hexes = gameScene(started(), content, 'de', new Map());
  const home = hexes.find((hex) => hex.planets.length > 0 && hex.ships.length > 0);
  if (home === undefined) throw new Error('kein Heimatsystem mit Flotte');
  return { hexes, home };
}

describe('Kamera der Sternenkarte', () => {
  it('Zoomen hält den Punkt unter dem Zeiger fest und bleibt in Grenzen', () => {
    const anchor = { x: 120, y: -40 };
    const from = { zoom: 2, panX: 30, panY: 10 };
    const to = zoomAround(from, 1.5, anchor);
    const world = { x: (anchor.x - from.panX) / from.zoom, y: (anchor.y - from.panY) / from.zoom };
    expect(to.panX + world.x * to.zoom).toBeCloseTo(anchor.x);
    expect(to.panY + world.y * to.zoom).toBeCloseTo(anchor.y);
    expect(zoomAround(from, 1000, anchor).zoom).toBe(ZOOM_MAX);
  });

  it('„System ansehen“ füllt etwa zwei Drittel der Bildhöhe mit dem Feld, mittig', () => {
    const bounds = boundsOf([
      { q: 0, r: 0 },
      { q: 3, r: 0 },
      { q: 0, r: 3 },
    ]);
    const zoom = systemZoom(bounds, SCREEN);
    const point = hexToPixel({ q: 3, r: 0 });
    const view = worldTransform(bounds, SCREEN, focusViewport(bounds, point, zoom));
    expect((60 * Math.sqrt(3) * view.scale) / SCREEN.height).toBeCloseTo(0.62, 2);
    expect(view.x + point.x * view.scale).toBeCloseTo(SCREEN.width / 2);
  });

  it('die Kamerafahrt beginnt am Start, endet am Ziel und zoomt gleichmäßig', () => {
    const from = { zoom: 1, panX: 0, panY: 0 };
    const to = { zoom: 4, panX: -300, panY: 120 };
    expect(blendViewport(from, to, 0)).toEqual(from);
    expect(blendViewport(from, to, 1)).toEqual(to);
    expect(blendViewport(from, to, 0.5).zoom).toBeCloseTo(2);
  });

  it('das Mausrad zoomt stufenlos: eine Raste gut ein Viertel, Trackpad-Schritte fein', () => {
    expect(wheelFactor(-100)).toBeCloseTo(1.246, 2);
    expect(wheelFactor(100)).toBeCloseTo(1 / 1.246, 2);
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-99), 5);
    expect(wheelFactor(-4)).toBeLessThan(1.01);
    expect(wheelFactor(-100000)).toBe(2);
  });

  it('Striche und Sterne wachsen beim Nahzoom nur gedämpft mit', () => {
    expect(detailLevel(0.5)).toBe(0);
    expect(lineScale(0)).toBe(1);
    const deep = detailLevel(ZOOM_MAX);
    expect(lineScale(deep) * ZOOM_MAX).toBeLessThan(ZOOM_MAX / 5);
    expect(lineScale(deep) * ZOOM_MAX).toBeGreaterThan(1);
  });
});

describe('Nahansicht der Planeten', () => {
  it('jeder Planet hat eigene Oberfläche; Farben liegen im Shader-Bereich 0–1', () => {
    const a = planetPaint('aurelis', 'industrial');
    const b = planetPaint('ombra', 'industrial');
    expect(a.seed).not.toEqual(b.seed);
    expect(planetPaint('aurelis', 'industrial')).toEqual(a);
    for (const value of [...a.low, ...a.high, ...a.atmosphere]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(planetPaint('thron', 'center').features[3]).toBe(1);
    expect(planetPaint('lava', 'hazardous').features[2]).toBe(1);
  });

  it('Sterne auf der Kachel liegen innerhalb des Sechsecks', () => {
    expect(insideHex({ x: 0, y: 0 }, 10)).toBe(true);
    expect(insideHex({ x: 9.9, y: 0 }, 10)).toBe(true);
    expect(insideHex({ x: 0, y: 9 }, 10)).toBe(false);
    expect(insideHex({ x: 8, y: 5 }, 10)).toBe(false);
  });

  it('erst beim Nahzoom stehen Schilder unter Planeten und Flotten, nur was im Bild ist', () => {
    const { hexes, home } = homeScene();
    const bounds = boundsOf(hexes.map((hex) => hex.position));
    const far = { zoom: CLOSE_ZOOM - 1, panX: 0, panY: 0 };
    expect(closeUpMarks(hexes, bounds, SCREEN, far)).toEqual([]);
    const near = focusViewport(bounds, hexToPixel(home.position), CLOSE_ZOOM + 1);
    const marks = closeUpMarks(hexes, bounds, SCREEN, near);
    const planets = marks.filter((mark) => mark.kind === 'planet' && mark.key.startsWith(home.key));
    expect(planets).toHaveLength(home.planets.length);
    expect(marks.some((mark) => mark.kind === 'fleet' && mark.key.startsWith(home.key))).toBe(true);
    expect(marks.length).toBeLessThan(hexes.length);
  });

  it('die Schilder nennen Planet, Werte, Truppen und die Flotte des Besitzers', () => {
    const { hexes, home } = homeScene();
    const bounds = boundsOf(hexes.map((hex) => hex.position));
    const viewport = focusViewport(bounds, hexToPixel(home.position), CLOSE_ZOOM + 1);
    render(<CloseUpLabels hexes={hexes} bounds={bounds} viewport={viewport} size={SCREEN} />);
    const list = screen.getByRole('list', { name: 'Aus der Nähe' });
    const name = home.planets[0]?.name ?? '';
    expect(within(list).getByText(name)).toBeTruthy();
    expect(list.textContent).toContain('Raumdock');
    expect(list.textContent).toContain('Träger');
  });
});
