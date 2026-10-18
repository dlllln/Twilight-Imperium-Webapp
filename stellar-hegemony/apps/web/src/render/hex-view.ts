import type { WormholeKind } from '@stellar/domain';
import { Container, Graphics, Sprite } from 'pixi.js';
import { HEX_SIZE, hexToPixel, type Point } from '../hex-geometry.ts';
import { seatColor } from '../seat-colors.ts';
import { boardArtwork, boardHasWormholeArt } from '../artwork/board.ts';
import { originalTexture } from './original-artwork.ts';
import { lift, plus, project, projectedCorners, turn } from './board-view.ts';
import { type BoardFrame, flatImage, type Placed, standing, stroked } from './board-pieces.ts';
import {
  cachePiece,
  controlRing,
  frontierToken,
  planetPiece,
  planetShadow,
  shipPiece,
  tokenChips,
} from './hex-pieces.ts';
import {
  PLANET_HEIGHT,
  planetDiameter,
  planetSpots,
  SHIP_HEIGHT,
  shipSlots,
  TOKEN_Y,
} from './hex-layout.ts';
import { hashString } from './noise.ts';
import { colorOf, GOLD, GOLD_BRIGHT, hexOf, mix, rgbOf } from './palette.ts';
import type { Highlight, SceneHex } from './scene-model.ts';
import { GLYPH_STYLE, label, SEAT_STYLE } from './text-styles.ts';
import { anomalyTexture, TILE_VARIANTS, tileTexture } from './textures.ts';

/**
 * Ebenen: Grund (Kacheln, Anomalien, Fugen), Schatten, Glühen (mit Bloom-Filter),
 * Figuren (Planeten, Flotten, Marker; nach Tiefe sortiert) und Zahlen, die beim Nahzoom
 * der Beschriftung im DOM weichen.
 */
export interface HexLayers {
  readonly base: Container;
  readonly shadows: Container;
  readonly glow: Container;
  readonly content: Container;
  readonly labels: Container;
}

/** Ein gebautes Feld: seine Stücke und der Rahmen, falls es hervorgehoben ist. */
export interface DrawnHex {
  readonly placed: readonly Placed[];
  readonly pulse: Graphics | null;
}

const SQRT3 = Math.sqrt(3);
const HALF_TILE: Point = { x: HEX_SIZE, y: (HEX_SIZE * SQRT3) / 2 };
const HALF_ANOMALY: Point = { x: HEX_SIZE * 0.75, y: HEX_SIZE * 0.75 };
const ORIGIN: Point = { x: 0, y: 0 };

const HIGHLIGHT_STROKES: Readonly<Record<Exclude<Highlight, 'none'>, [number, number]>> = {
  active: [GOLD_BRIGHT, 2],
  selected: [0xffffff, 1.4],
  origin: [0x58e1c1, 1.4],
  legal: [0x8fe3ff, 1.6],
  chosen: [0xffd36b, 2],
};

const WORMHOLE_COLORS: Readonly<Record<WormholeKind, number>> = { alpha: 0xff9b4a, beta: 0x6fd3ff };
const WORMHOLE_SPOT = { x: 34, y: -22 };
/** Grenzmarker und Depot liegen in Systemen ohne Planeten, also frei in der Feldmitte. */
const FRONTIER_SPOT = { x: 0, y: -10 };
const CACHE_SPOT = { x: -24, y: -14 };

const variantOf = (hex: SceneHex): number => hashString(hex.key) % TILE_VARIANTS;
const lighten = (color: number): number => colorOf(mix(rgbOf(color), [255, 255, 255], 0.55));
const flatPoints = (points: readonly Point[]): number[] => points.flatMap(({ x, y }) => [x, y]);

/** Kachelfläche und Anomalie flach auf dem Brett. */
function ground(hex: SceneHex, center: Point, layers: HexLayers): Placed[] {
  const original = originalTexture(boardArtwork(hex));
  if (original !== undefined) return [flatImage(layers.base, original, center, HALF_TILE)];
  const placed = [flatImage(layers.base, tileTexture(hex.back, variantOf(hex)), center, HALF_TILE)];
  if (hex.anomaly !== undefined && hex.anomaly !== 'supernova')
    placed.push(flatImage(layers.base, anomalyTexture(hex.anomaly), center, HALF_ANOMALY));
  return placed;
}

/** Dünne, saubere Linie mit weichem Schein (den der Bloom-Filter weich zeichnet). */
function softFrame(
  graphics: Graphics,
  outline: number[],
  width: number,
  color: number,
  strength: number,
) {
  graphics
    .poly(outline)
    .fill({ color, alpha: 0.07 * strength })
    .stroke({ width: width * 2.5, color, alpha: 0.16 * strength })
    .poly(outline)
    .stroke({ width, color: lighten(color), alpha: 0.45 + 0.5 * strength });
}

interface Trim {
  readonly color: number;
  readonly inset: number;
  readonly width: number;
  readonly strength: number;
}

/** Heimatsysteme in der Farbe ihres Platzes, die Mitte in Gold, sonst färbt der alleinige Besitzer den Rand. */
function trimOf(hex: SceneHex): Trim | null {
  if (hex.seat !== null)
    return { color: hexOf(seatColor(hex.seat)), inset: 0.94, width: 1.3, strength: 1 };
  if (hex.control !== null)
    return { color: hexOf(seatColor(hex.control)), inset: 0.96, width: 1.1, strength: 0.6 };
  if (hex.back === 'center') return { color: GOLD, inset: 0.95, width: 1.2, strength: 0.7 };
  return null;
}

function border(
  hex: SceneHex,
  center: Point,
): ((graphics: Graphics, frame: BoardFrame) => void) | null {
  const trim = trimOf(hex);
  if (trim === null) return null;
  return (graphics, { view, line }) => {
    const outline = flatPoints(projectedCorners(view, center, HEX_SIZE * trim.inset));
    const width = trim.width * line * project(view, center).scale;
    softFrame(graphics, outline, width, trim.color, trim.strength);
  };
}

/** Wo ein Planet im Bild schwebt. */
const planetAt = (hex: SceneHex, center: Point, index: number, frame: BoardFrame) =>
  lift(
    plus(turn(frame.view, center), planetSpots(hex.planets.length)[index] ?? ORIGIN),
    PLANET_HEIGHT,
    frame.view.tilt,
  );

/** Ringe in der Farbe des Besitzers um kontrollierte Planeten. */
function controlRings(hex: SceneHex, center: Point) {
  return (graphics: Graphics, frame: BoardFrame) => {
    hex.planets.forEach((planet, index) => {
      if (planet.controllerSeat === null) return;
      const radius = planetDiameter(planet, hex.planets.length) / 2;
      controlRing(
        graphics,
        planet.controllerSeat,
        planetAt(hex, center, index, frame),
        radius,
        frame.line,
      );
    });
  };
}

function highlightFrame(hex: SceneHex, center: Point, layer: Container) {
  if (hex.highlight === 'none') return null;
  const [color, stroke] = HIGHLIGHT_STROKES[hex.highlight];
  return stroked(layer, (graphics, { view, line }) => {
    const outline = flatPoints(projectedCorners(view, center, HEX_SIZE * 0.97));
    const width = stroke * line * project(view, center).scale;
    graphics
      .poly(outline)
      .stroke({ width: width * 2.5, color, alpha: 0.22 })
      .poly(outline)
      .stroke({ width, color });
  });
}

function supernova(center: Point, layer: Container): Placed {
  const star = new Sprite(anomalyTexture('supernova'));
  star.anchor.set(0.5);
  star.setSize(HEX_SIZE * 1.4, HEX_SIZE * 1.4);
  // In einem Behälter, denn `standing` setzt den Maßstab des äußeren Objekts.
  const holder = new Container();
  holder.addChild(star);
  return standing({ center, offset: ORIGIN, height: 10 }, [[layer, holder]]);
}

/** Leuchtende Elemente: Spielerrand, Kontrollringe, Supernova, Hervorhebung. */
function glow(hex: SceneHex, center: Point, layer: Container): DrawnHex {
  const placed: Placed[] = [];
  if (hex.anomaly === 'supernova' && originalTexture(boardArtwork(hex)) === undefined)
    placed.push(supernova(center, layer));
  const frame = border(hex, center);
  if (frame !== null) placed.push(stroked(layer, frame));
  if (hex.planets.some((planet) => planet.controllerSeat !== null))
    placed.push(stroked(layer, controlRings(hex, center)));
  const pulse = highlightFrame(hex, center, layer);
  if (pulse !== null) placed.push(pulse);
  return { placed, pulse: pulse?.graphics ?? null };
}

function wormholeToken(kind: WormholeKind): Container {
  const token = new Container();
  token.addChild(
    new Graphics()
      .circle(0, 0, 8)
      .fill({ color: 0x000000, alpha: 0.6 })
      .stroke({ width: 2.2, color: WORMHOLE_COLORS[kind] }),
    label(kind === 'alpha' ? 'α' : 'β', GLYPH_STYLE, 0, 0),
  );
  return token;
}

/** Planeten mit Schatten, Truppen und Werten. */
function planets(hex: SceneHex, center: Point, layers: HexLayers): Placed[] {
  const spots = planetSpots(hex.planets.length);
  return hex.planets.flatMap((planet, index) => {
    const diameter = planetDiameter(planet, hex.planets.length);
    const offset = spots[index] ?? ORIGIN;
    const { body, labels } = planetPiece(planet, diameter);
    return [
      standing({ center, offset, flat: true }, [[layers.shadows, planetShadow(diameter)]]),
      standing({ center, offset, height: PLANET_HEIGHT }, [
        [layers.content, body],
        [layers.labels, labels],
      ]),
    ];
  });
}

function ships(hex: SceneHex, center: Point, layers: HexLayers): Placed[] {
  const slots = shipSlots(hex.ships.length);
  return hex.ships.map((unit, index) => {
    const { body, labels } = shipPiece(unit);
    return standing({ center, offset: slots[index] ?? ORIGIN, height: SHIP_HEIGHT }, [
      [layers.content, body],
      [layers.labels, labels],
    ]);
  });
}

function wormholesOnBoard(hex: SceneHex): readonly WormholeKind[] {
  const drawnWormholes =
    boardHasWormholeArt(hex) && originalTexture(boardArtwork(hex)) !== undefined;
  return drawnWormholes ? [] : hex.wormholes;
}

/** Wurmlöcher, Platznummer und Kommandomarker. */
function markers(hex: SceneHex, center: Point, layers: HexLayers): Placed[] {
  const placed = wormholesOnBoard(hex).map((kind, index) =>
    standing({ center, offset: { x: WORMHOLE_SPOT.x, y: WORMHOLE_SPOT.y + index * 20 } }, [
      [layers.content, wormholeToken(kind)],
    ]),
  );
  if (hex.kind === 'homeSlot' && hex.seat !== null)
    placed.push(
      standing({ center, offset: ORIGIN }, [
        [layers.content, label(String(hex.seat), SEAT_STYLE, 0, 0)],
      ]),
    );
  if (hex.tokens.length > 0)
    placed.push(
      standing({ center, offset: { x: 0, y: TOKEN_Y }, flat: true }, [
        [layers.content, tokenChips(hex.tokens)],
      ]),
    );
  return placed;
}

/** PoK Grenzmarker und Handelswaren-Depot. */
function exploration(hex: SceneHex, center: Point, layers: HexLayers): Placed[] {
  const placed: Placed[] = [];
  if (hex.frontier)
    placed.push(
      standing({ center, offset: FRONTIER_SPOT, flat: true }, [[layers.content, frontierToken()]]),
    );
  if (hex.cache > 0) {
    const { body, labels } = cachePiece(hex.cache);
    placed.push(
      standing({ center, offset: CACHE_SPOT }, [
        [layers.content, body],
        [layers.labels, labels],
      ]),
    );
  }
  return placed;
}

/** Baut ein Hexfeld in alle Ebenen; ausgerichtet wird es erst mit `arrange`. */
export function drawHex(hex: SceneHex, layers: HexLayers): DrawnHex {
  const center = hexToPixel(hex.position);
  const shine = glow(hex, center, layers.glow);
  const placed = [
    ...ground(hex, center, layers),
    ...shine.placed,
    ...planets(hex, center, layers),
    ...ships(hex, center, layers),
    ...markers(hex, center, layers),
    ...exploration(hex, center, layers),
  ];
  return { placed, pulse: shine.pulse };
}
