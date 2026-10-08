import type { WormholeKind } from '@stellar/domain';
import { Container, Graphics, Sprite } from 'pixi.js';
import { HEX_SIZE, hexCorners, hexToPixel } from '../hex-geometry.ts';
import { seatColor } from '../seat-colors.ts';
import {
  controlRing,
  planetDiameter,
  planetPiece,
  planetSpots,
  shipRows,
  tokenChips,
} from './hex-pieces.ts';
import { FRAME, GOLD, GOLD_BRIGHT, hexOf, mix, rgbOf } from './palette.ts';
import type { Highlight, SceneHex } from './scene-model.ts';
import { GLYPH_STYLE, label, SEAT_STYLE } from './text-styles.ts';
import { hashString } from './noise.ts';
import { anomalyTexture, TILE_RADIUS, TILE_VARIANTS, tileTexture } from './textures.ts';
import { TILE_SHAPE, tileAnchor, tileFrame } from './tile-shape.ts';

/** Drei Ebenen: Grund (Fläche, Anomalie), Glühen (mit Bloom-Filter), Inhalt (Planeten, Flotten). */
export interface HexLayers {
  readonly base: Container;
  readonly glow: Container;
  readonly content: Container;
}

const ORIGIN = { x: 0, y: 0 };
const corners = (scale: number) => hexCorners(ORIGIN, HEX_SIZE * scale).flatMap((p) => [p.x, p.y]);

const HIGHLIGHT_STROKES: Readonly<Record<Exclude<Highlight, 'none'>, [number, number]>> = {
  active: [GOLD_BRIGHT, 3.5],
  selected: [0xffffff, 2.5],
  origin: [0x58e1c1, 2],
};

const WORMHOLE_COLORS: Readonly<Record<WormholeKind, number>> = { alpha: 0xff9b4a, beta: 0x6fd3ff };
const WORMHOLE_SPOT = { x: 34, y: -22 };

const TILE = tileFrame(TILE_RADIUS);
const FACE = TILE_SHAPE.face;
const variantOf = (hex: SceneHex): number => hashString(hex.key) % TILE_VARIANTS;

function tileSprite(hex: SceneHex): Sprite {
  const tile = new Sprite(tileTexture(hex.back, variantOf(hex)));
  const anchor = tileAnchor(TILE);
  tile.anchor.set(anchor.x, anchor.y);
  tile.scale.set(HEX_SIZE / TILE_RADIUS);
  return tile;
}

/** Plastische Kachel (Schatten, Wände, Lichtkante), darüber Anomalie und Metallfassung. */
function face(hex: SceneHex): Container {
  const base = new Container();
  base.addChild(tileSprite(hex));
  if (hex.anomaly !== undefined && hex.anomaly !== 'supernova') {
    const anomaly = new Sprite(anomalyTexture(hex.anomaly));
    anomaly.anchor.set(0.5);
    anomaly.setSize(HEX_SIZE * 1.5, HEX_SIZE * 1.5);
    base.addChild(anomaly);
  }
  const trim = hex.back === 'center' ? GOLD : FRAME;
  base.addChild(
    new Graphics().poly(corners(FACE)).stroke({ width: 1.4, color: trim, alpha: 0.9 }),
    new Graphics()
      .poly(corners(FACE * (1 - TILE_SHAPE.bevel)))
      .stroke({ width: 0.6, color: GOLD, alpha: 0.3 }),
  );
  return base;
}

function supernovaGlow(): Sprite {
  const star = new Sprite(anomalyTexture('supernova'));
  star.anchor.set(0.5);
  star.setSize(HEX_SIZE * 1.4, HEX_SIZE * 1.4);
  return star;
}

function wormholeRing(kind: WormholeKind, index: number): Graphics {
  const y = WORMHOLE_SPOT.y + index * 20;
  return new Graphics()
    .circle(WORMHOLE_SPOT.x, y, 8)
    .fill({ color: 0x000000, alpha: 0.6 })
    .stroke({ width: 2.4, color: WORMHOLE_COLORS[kind] });
}

/** Leuchtende Elemente: Spielerrand, Kontrollringe, Wurmlöcher, Hervorhebung. */
function glow(hex: SceneHex): { readonly layer: Container; readonly pulse: Graphics | null } {
  const layer = new Container();
  if (hex.anomaly === 'supernova') layer.addChild(supernovaGlow());
  const border = controlBorder(hex);
  if (border !== null) layer.addChild(border);
  const spots = planetSpots(hex.planets.length);
  hex.planets.forEach((planet, index) => {
    const spot = spots[index] ?? ORIGIN;
    if (planet.controllerSeat !== null)
      layer.addChild(
        controlRing(planet.controllerSeat, planetDiameter(planet, hex.planets.length), spot),
      );
  });
  hex.wormholes.forEach((kind, index) => layer.addChild(wormholeRing(kind, index)));
  const pulse = highlightFrame(hex.highlight);
  if (pulse !== null) layer.addChild(pulse);
  return { layer, pulse };
}

const lighten = (color: number): number => {
  const [r, g, b] = mix(rgbOf(color), [255, 255, 255], 0.55);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};

/** Leuchtender Rand in Platzfarbe: breiter Schein, darüber eine scharfe helle Linie. */
function seatFrame(seat: number, scale: number, strength: number): Graphics {
  const color = hexOf(seatColor(seat));
  const shape = corners(scale);
  return new Graphics()
    .poly(shape)
    .stroke({ width: 9, color, alpha: 0.2 * strength })
    .poly(shape)
    .stroke({ width: 4.5, color, alpha: 0.45 * strength })
    .poly(shape)
    .stroke({ width: 1.8, color: lighten(color), alpha: 0.5 + 0.5 * strength });
}

/** Heimatsysteme tragen die Farbe ihres Platzes, sonst färbt der alleinige Besitzer den Rand. */
function controlBorder(hex: SceneHex): Graphics | null {
  if (hex.seat !== null) return seatFrame(hex.seat, FACE * 0.95, 1);
  if (hex.control === null) return null;
  return seatFrame(hex.control, FACE * 0.97, 0.7);
}

function highlightFrame(highlight: Highlight): Graphics | null {
  if (highlight === 'none') return null;
  const [color, width] = HIGHLIGHT_STROKES[highlight];
  return new Graphics()
    .poly(corners(FACE * 0.97))
    .stroke({ width: width * 3, color, alpha: 0.25 })
    .poly(corners(FACE * 0.97))
    .stroke({ width, color });
}

const wormholeGlyph = (kind: WormholeKind, index: number) =>
  label(kind === 'alpha' ? 'α' : 'β', GLYPH_STYLE, WORMHOLE_SPOT.x, WORMHOLE_SPOT.y + index * 20);

function contents(hex: SceneHex): Container {
  const layer = new Container();
  const spots = planetSpots(hex.planets.length);
  hex.planets.forEach((planet, index) => {
    const diameter = planetDiameter(planet, hex.planets.length);
    layer.addChild(planetPiece(planet, diameter, spots[index] ?? ORIGIN));
  });
  hex.wormholes.forEach((kind, index) => layer.addChild(wormholeGlyph(kind, index)));
  if (hex.kind === 'homeSlot' && hex.seat !== null)
    layer.addChild(label(String(hex.seat), SEAT_STYLE, 0, 0));
  layer.addChild(shipRows(hex.ships), tokenChips(hex.tokens));
  return layer;
}

/** Zeichnet ein Hexfeld in die drei Ebenen; liefert den pulsierenden Rahmen, falls vorhanden. */
export function drawHex(hex: SceneHex, layers: HexLayers): Graphics | null {
  const center = hexToPixel(hex.position);
  const { layer: glowLayer, pulse } = glow(hex);
  const parts: readonly [Container, Container][] = [
    [layers.base, face(hex)],
    [layers.glow, glowLayer],
    [layers.content, contents(hex)],
  ];
  for (const [target, part] of parts) {
    part.position.set(center.x, center.y);
    // Weiter unten liegende Kacheln decken Schatten und Schiffe der oberen ab.
    part.zIndex = center.y;
    target.addChild(part);
  }
  return pulse;
}
