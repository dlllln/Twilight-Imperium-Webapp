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
import { FRAME, GOLD, GOLD_BRIGHT, hexOf } from './palette.ts';
import type { Highlight, SceneHex } from './scene-model.ts';
import { GLYPH_STYLE, label, LABEL_STYLE, SEAT_STYLE } from './text-styles.ts';
import { anomalyTexture, tileTexture } from './textures.ts';

/** Drei Ebenen: Grund (Fläche, Anomalie), Glühen (mit Bloom-Filter), Inhalt (Planeten, Flotten). */
export interface HexLayers {
  readonly base: Container;
  readonly glow: Container;
  readonly content: Container;
}

const SQRT3 = Math.sqrt(3);
const ORIGIN = { x: 0, y: 0 };
const corners = (scale: number) => hexCorners(ORIGIN, HEX_SIZE * scale).flatMap((p) => [p.x, p.y]);

const HIGHLIGHT_STROKES: Readonly<Record<Exclude<Highlight, 'none'>, [number, number]>> = {
  active: [GOLD_BRIGHT, 3.5],
  selected: [0xffffff, 2.5],
  origin: [0x58e1c1, 2],
};

const WORMHOLE_COLORS: Readonly<Record<WormholeKind, number>> = { alpha: 0xff9b4a, beta: 0x6fd3ff };
const WORMHOLE_SPOT = { x: 34, y: -22 };

function face(hex: SceneHex): Container {
  const base = new Container();
  const tile = new Sprite(tileTexture(hex.back));
  tile.anchor.set(0.5);
  tile.setSize(HEX_SIZE * 2, HEX_SIZE * SQRT3);
  base.addChild(tile);
  if (hex.anomaly !== undefined && hex.anomaly !== 'supernova') {
    const anomaly = new Sprite(anomalyTexture(hex.anomaly));
    anomaly.anchor.set(0.5);
    anomaly.setSize(HEX_SIZE * 1.5, HEX_SIZE * 1.5);
    base.addChild(anomaly);
  }
  const trim = hex.back === 'center' ? GOLD : FRAME;
  base.addChild(
    new Graphics().poly(corners(1)).stroke({ width: 2, color: trim, alpha: 0.9 }),
    new Graphics().poly(corners(0.985)).stroke({ width: 0.8, color: GOLD, alpha: 0.4 }),
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
  if (hex.seat !== null)
    layer.addChild(
      new Graphics().poly(corners(0.9)).stroke({ width: 3, color: hexOf(seatColor(hex.seat)) }),
    );
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

function highlightFrame(highlight: Highlight): Graphics | null {
  if (highlight === 'none') return null;
  const [color, width] = HIGHLIGHT_STROKES[highlight];
  return new Graphics().poly(corners(0.95)).stroke({ width, color });
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
  if (hex.systemId !== null && hex.ships.length === 0 && hex.seat === null)
    layer.addChild(label(hex.systemId.toUpperCase(), LABEL_STYLE, 0, 46));
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
    target.addChild(part);
  }
  return pulse;
}
