// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CloseUpLabels } from '../src/components/CloseUpLabels.tsx';
import { HexTooltip } from '../src/components/HexTooltip.tsx';
import { useSettingsStore } from '../src/settings-store.ts';
import { boundsOf, hexToPixel } from '../src/hex-geometry.ts';
import { planetPaint } from '../src/render/planet-paint.ts';
import { gameScene, type SceneHex } from '../src/render/scene-model.ts';
import { insideHex } from '../src/hex-geometry.ts';
import {
  boardBounds,
  FLAT_VIEW,
  FORESHORTEN,
  project,
  viewFrom,
} from '../src/render/board-view.ts';
import { homeOf } from '../src/system/board-camera.ts';
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
import { pinchStep, usePanZoom, wheelFactor } from '../src/use-pan-zoom.ts';
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

/** Szene mit Blick vom Heimatsystem des ersten Platzes, wie in der Partie. */
function tilted() {
  const { hexes, home } = homeScene();
  const view = viewFrom(homeOf(hexes, 1));
  const bounds = boardBounds(
    view,
    hexes.map((hex) => hexToPixel(hex.position)),
  );
  return { hexes, home, view, bounds };
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

  it('„System ansehen“ füllt die halbe Bildhöhe mit dem schräg liegenden Feld, mittig', () => {
    const bounds = boundsOf([
      { q: 0, r: 0 },
      { q: 3, r: 0 },
      { q: 0, r: 3 },
    ]);
    const point = project(FLAT_VIEW, hexToPixel({ q: 3, r: 0 }));
    const zoom = systemZoom(bounds, SCREEN, point.scale);
    const view = worldTransform(bounds, SCREEN, focusViewport(bounds, point, zoom));
    const height = 60 * Math.sqrt(3) * FORESHORTEN * point.scale * view.scale;
    expect(height / SCREEN.height).toBeCloseTo(0.5, 2);
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

  it('zwei Finger: auseinander zoomt um den Mittelpunkt, gemeinsames Wandern verschiebt', () => {
    const step = pinchStep(
      [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
      [
        { x: 60, y: 120 },
        { x: 260, y: 120 },
      ],
    );
    expect(step).toEqual({ factor: 2, center: { x: 160, y: 120 }, dx: 10, dy: 20, twist: 0 });
    const turned = pinchStep(
      [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
      [
        { x: 150, y: 50 },
        { x: 150, y: 150 },
      ],
    );
    expect(turned.twist).toBeCloseTo(Math.PI / 2);
    expect(turned.factor).toBeCloseTo(1);
  });

  it('am Tablet: zwei Finger zoomen die Karte, ein Finger verschiebt sie und wählt dann nichts', () => {
    const zooms: number[] = [];
    let drag: () => boolean = () => false;
    function Surface() {
      const svg = useRef<SVGSVGElement>(null);
      const gestures = usePanZoom(svg, 100, (factor) => zooms.push(factor));
      drag = gestures.wasDrag;
      const { onPointerDown, onPointerMove, onPointerUp } = gestures;
      return <div data-testid="surface" {...{ onPointerDown, onPointerMove, onPointerUp }} />;
    }
    render(<Surface />);
    const surface = screen.getByTestId('surface');
    const finger = (pointerId: number, clientX: number) => ({
      pointerId,
      clientX,
      clientY: 50,
      pointerType: 'touch',
    });
    fireEvent.pointerDown(surface, finger(1, 100));
    fireEvent.pointerDown(surface, finger(2, 200));
    fireEvent.pointerMove(surface, finger(2, 300));
    expect(zooms).toEqual([2]);
    expect(drag()).toBe(true);
    fireEvent.pointerUp(surface, finger(2, 300));
    fireEvent.pointerUp(surface, finger(1, 100));
    fireEvent.pointerDown(surface, finger(3, 100));
    expect(drag()).toBe(false);
  });

  it('der Hinweis am Zeiger ist knapp: Planeten in einer Zeile, Bedienhilfe nur bis zum ersten Klick', () => {
    const { home } = homeScene();
    useSettingsStore.setState({ hintSeen: false });
    const { rerender } = render(<HexTooltip hex={home} x={10} y={10} />);
    const tip = screen.getByRole('tooltip');
    expect(tip.querySelectorAll('.tooltip-planet')).toHaveLength(home.planets.length);
    expect(tip.querySelector('.tooltip-hint')).not.toBeNull();
    useSettingsStore.getState().markHintSeen();
    rerender(<HexTooltip hex={home} x={10} y={10} />);
    expect(screen.getByRole('tooltip').querySelector('.tooltip-hint')).toBeNull();
    rerender(<HexTooltip hex={home} x={window.innerWidth - 5} y={window.innerHeight - 5} />);
    const flipped = screen.getByRole('tooltip').style;
    const [left, top] = flipped.transform.match(/[\d.]+/g)?.map(Number) ?? [];
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThan(window.innerWidth - 5);
    expect(top).toBeLessThan(window.innerHeight - 5);
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

  it('ein Punkt liegt genau dann im Sechseck, wenn er innerhalb der Kanten ist', () => {
    expect(insideHex({ x: 0, y: 0 }, 10)).toBe(true);
    expect(insideHex({ x: 9.9, y: 0 }, 10)).toBe(true);
    expect(insideHex({ x: 0, y: 9 }, 10)).toBe(false);
    expect(insideHex({ x: 8, y: 5 }, 10)).toBe(false);
  });

  it('erst beim Nahzoom stehen Schilder unter Planeten und Flotten, nur was im Bild ist', () => {
    const { hexes, home, view, bounds } = tilted();
    const far = { zoom: CLOSE_ZOOM - 1, panX: 0, panY: 0 };
    expect(closeUpMarks(hexes, bounds, SCREEN, far, view)).toEqual([]);
    const near = focusViewport(bounds, project(view, hexToPixel(home.position)), CLOSE_ZOOM + 2);
    const marks = closeUpMarks(hexes, bounds, SCREEN, near, view);
    const planets = marks.filter((mark) => mark.kind === 'planet' && mark.key.startsWith(home.key));
    expect(planets).toHaveLength(home.planets.length);
    expect(marks.some((mark) => mark.kind === 'fleet' && mark.key.startsWith(home.key))).toBe(true);
    expect(marks.length).toBeLessThan(hexes.length);
  });

  it('die Schilder nennen Planet, Werte, Truppen und die Flotte des Besitzers', () => {
    const { hexes, home, view, bounds } = tilted();
    const viewport = focusViewport(
      bounds,
      project(view, hexToPixel(home.position)),
      CLOSE_ZOOM + 2,
    );
    render(
      <CloseUpLabels hexes={hexes} bounds={bounds} viewport={viewport} view={view} size={SCREEN} />,
    );
    const list = screen.getByRole('list', { name: 'Aus der Nähe' });
    const name = home.planets[0]?.name ?? '';
    expect(within(list).getByText(name)).toBeTruthy();
    expect(list.textContent).toContain('Raumdock');
    expect(list.textContent).toContain('Träger');
  });
});
