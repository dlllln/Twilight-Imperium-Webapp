import { describe, expect, it } from 'vitest';
import { hexToPixel, type Point } from '../src/hex-geometry.ts';
import {
  type BoardView,
  boardBounds,
  lift,
  plus,
  project,
  turn,
  viewFrom,
} from '../src/render/board-view.ts';
import { PLANET_HEIGHT, planetDiameter, planetSpots } from '../src/render/hex-layout.ts';
import { gameScene, type SceneHex } from '../src/render/scene-model.ts';
import { worldTransform } from '../src/render/view-transform.ts';
import { homeOf } from '../src/system/board-camera.ts';
import { closeUpMarks } from '../src/system/close-up.ts';
import { planetAnchors } from '../src/system/map-anchors.ts';
import { CLOSE_ZOOM, focusViewport } from '../src/system/viewport-tween.ts';
import { content } from '../src/store.ts';
import { started } from './game-helpers.ts';

const SCREEN = { width: 1600, height: 900 };
const ORIGIN = { x: 0, y: 0 };

function scene(): { readonly hexes: readonly SceneHex[]; readonly view: BoardView } {
  const hexes = gameScene(started(), content, 'de', new Map());
  return { hexes, view: viewFrom(homeOf(hexes, 1)) };
}

/** Ein Feld mit mindestens `count` Planeten. */
function hexWith(hexes: readonly SceneHex[], count: number): SceneHex {
  const hex = hexes.find((candidate) => candidate.planets.length >= count);
  if (hex === undefined) throw new Error(`kein Feld mit ${String(count)} Planeten`);
  return hex;
}

/** Die Nahzoom-Schilder der Planeten nach der Formel vor der Umstellung auf Ankerpunkte. */
function oldPlanetMarks(hex: SceneHex, view: BoardView, toScreen: (at: Point) => Point) {
  const center = turn(view, hexToPixel(hex.position));
  const spots = planetSpots(hex.planets.length);
  return hex.planets.map((planet, index) => {
    const radius = planetDiameter(planet, hex.planets.length) / 2;
    const at = lift(plus(center, spots[index] ?? ORIGIN), PLANET_HEIGHT, view.tilt);
    return toScreen({ x: at.x, y: at.y + (radius + 3) * at.scale });
  });
}

const span = (points: readonly Point[]): number =>
  Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));

describe('Ankerpunkte der Planeten auf der Karte', () => {
  it('jeder Planet eines Felds bekommt einen Ankerpunkt über seinem Platz', () => {
    const { hexes, view } = scene();
    const hex = hexWith(hexes, 2);
    const anchors = planetAnchors(hex, view);
    expect(anchors.map((anchor) => anchor.planet.id)).toEqual(hex.planets.map((p) => p.id));
    const center = turn(view, hexToPixel(hex.position));
    anchors.forEach((anchor, index) => {
      const spot = plus(center, planetSpots(hex.planets.length)[index] ?? ORIGIN);
      const ground = lift(spot, 0, view.tilt);
      expect(anchor.at.x).toBeCloseTo(lift(spot, PLANET_HEIGHT, view.tilt).x);
      expect(anchor.at.y).toBeLessThan(ground.y);
      const diameter = planetDiameter(anchor.planet, hex.planets.length);
      expect(anchor.radius).toBeCloseTo((diameter / 2) * anchor.at.scale);
    });
  });

  it('die Nahzoom-Schilder stehen unter denselben Ankerpunkten wie vorher', () => {
    const { hexes, view } = scene();
    const hex = hexWith(hexes, 2);
    const bounds = boardBounds(
      view,
      hexes.map((h) => hexToPixel(h.position)),
    );
    const viewport = focusViewport(bounds, project(view, hexToPixel(hex.position)), CLOSE_ZOOM + 2);
    const camera = worldTransform(bounds, SCREEN, viewport);
    const toScreen = ({ x, y }: Point) => ({
      x: camera.x + x * camera.scale,
      y: camera.y + y * camera.scale,
    });
    const marks = closeUpMarks(hexes, bounds, SCREEN, viewport, view).filter(
      (mark) => mark.kind === 'planet' && mark.key.startsWith(`${hex.key}:`),
    );
    const before = oldPlanetMarks(hex, view, toScreen);
    expect(marks).toHaveLength(before.length);
    marks.forEach((mark, index) => {
      expect(mark.at.x).toBeCloseTo(before[index]?.x ?? Number.NaN, 6);
      expect(mark.at.y).toBeCloseTo(before[index]?.y ?? Number.NaN, 6);
    });
  });

  it('größere Neigung rückt die Anker zusammen', () => {
    const { hexes, view } = scene();
    const hex = hexWith(hexes, 2);
    const flat = planetAnchors(hex, { ...view, tilt: 0.3 }).map((anchor) => anchor.at);
    const steep = planetAnchors(hex, { ...view, tilt: 1.1 }).map((anchor) => anchor.at);
    expect(span(flat)).toBeGreaterThan(0);
    expect(span(steep)).toBeLessThan(span(flat));
  });
});
