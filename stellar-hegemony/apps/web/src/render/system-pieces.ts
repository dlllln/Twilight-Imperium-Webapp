import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { seatColor } from '../seat-colors.ts';
import type {
  CentralBody,
  Fleet,
  GroundPiece,
  PlacedPlanet,
  PlacedShip,
  SystemLayout,
} from '../system/system-layout.ts';
import { seededRandom } from './noise.ts';
import { hexOf, type Rgb } from './palette.ts';
import { starColor } from './star-texture.ts';
import {
  detailAnomalyTexture,
  detailPlanetTexture,
  detailUnitTexture,
  glowTexture,
  SHIP_ASPECT,
  starTexture,
} from './textures.ts';

/** Ein Teil der Systembühne: was gezeichnet wird und wie es sich mit der Zeit bewegt. */
export interface Piece {
  readonly display: Container;
  readonly animate: (time: number) => void;
}

const SHIP_WIDTH = 190;
const FIGHTER_WIDTH = 52;
const GROUND_SIZE = 34;
const MOON_SIZE = 26;
const FIGHTER_ORBIT = { rx: 300, ry: 110 } as const;
const STAR_COUNT = 140;
const ATMOSPHERE = 1.15;

const toHex = ([r, g, b]: Rgb): number => (r << 16) | (g << 8) | b;
const seatHex = (seat: number): number => hexOf(seatColor(seat));

function sprite(texture: Texture, width: number, height = width): Sprite {
  const result = new Sprite(texture);
  result.anchor.set(0.5);
  result.width = width;
  result.height = height;
  return result;
}

function glow(color: number, size: number, alpha: number): Sprite {
  const result = sprite(glowTexture(), size);
  result.tint = color;
  result.alpha = alpha;
  result.blendMode = 'add';
  return result;
}

/** Funkelnde Hintergrundsterne in festen, aber je System verschiedenen Positionen. */
export function starfield(seed: number, width: number, height: number): Piece {
  const random = seededRandom(seed);
  const display = new Container();
  const stars = Array.from({ length: STAR_COUNT }, () => {
    const star = glow(0xffffff, 3 + random() * 7, 0.3 + random() * 0.6);
    star.position.set((random() - 0.5) * width, (random() - 0.5) * height);
    display.addChild(star);
    return { star, phase: random() * Math.PI * 2, base: star.alpha };
  });
  const animate = (time: number) => {
    for (const { star, phase, base } of stars)
      star.alpha = base * (0.65 + 0.35 * Math.sin(time * 0.002 + phase));
  };
  return { display, animate };
}

function sun(layout: SystemLayout): Piece {
  const { x, y, radius, hue } = layout.star;
  const display = new Container();
  display.position.set(x, y);
  const halo = glow(toHex(starColor(hue)), radius * 5, 0.45);
  const body = sprite(starTexture(hue), radius * 2.4);
  display.addChild(halo, body);
  const animate = (time: number) => {
    body.rotation = time * 0.00004;
    body.scale.set((radius * 2.4 * (1 + 0.015 * Math.sin(time * 0.0012))) / body.texture.width);
    halo.alpha = 0.4 + 0.08 * Math.sin(time * 0.0017);
  };
  return { display, animate };
}

function anomalyBody(layout: SystemLayout, kind: 'supernova' | 'gravityRift'): Piece {
  const { x, y, radius } = layout.star;
  const display = new Container();
  display.position.set(x, y);
  const body = sprite(detailAnomalyTexture(kind), radius * 2.6);
  const direction = kind === 'gravityRift' ? -1 : 1;
  display.addChild(glow(kind === 'supernova' ? 0xff7a2a : 0x8a4dff, radius * 4, 0.5), body);
  return { display, animate: (time) => (body.rotation = direction * time * 0.00012) };
}

const CENTRAL: Readonly<Record<CentralBody, (layout: SystemLayout) => Piece>> = {
  star: sun,
  distant: sun,
  supernova: (layout) => anomalyBody(layout, 'supernova'),
  rift: (layout) => anomalyBody(layout, 'gravityRift'),
};

export const centralPiece = (layout: SystemLayout): Piece => CENTRAL[layout.central](layout);

/** Nebel und Asteroiden liegen als große Schichten hinter und vor der Bühne. */
export function backdropPiece(layout: SystemLayout): Piece | null {
  if (layout.backdrop !== 'nebula' && layout.backdrop !== 'asteroidField') return null;
  const texture = detailAnomalyTexture(layout.backdrop);
  const display = new Container();
  const layers = [-420, 0, 420].map((x, index) => {
    const layer = sprite(texture, 900 - index * 120);
    layer.position.set(x, index === 1 ? 160 : -60);
    layer.alpha = 0.75;
    display.addChild(layer);
    return layer;
  });
  const animate = (time: number) =>
    layers.forEach((layer, index) => (layer.rotation = (index - 1) * time * 0.00003));
  return { display, animate };
}

export function orbitPiece(planet: PlacedPlanet, center: { x: number; y: number }): Piece {
  const display = new Container();
  const line = new Graphics()
    .ellipse(center.x, center.y, planet.orbit.rx, planet.orbit.ry)
    .stroke({ width: 2, color: 0x9fb4ff, alpha: 0.22 });
  const marker = glow(0xbfd0ff, 14, 0.8);
  display.addChild(line, marker);
  const speed = 0.00008 + 0.00004 * (planet.orbit.rx / 1000);
  const animate = (time: number) => {
    const angle = time * speed;
    marker.position.set(
      center.x + Math.cos(angle) * planet.orbit.rx,
      center.y + Math.sin(angle) * planet.orbit.ry,
    );
  };
  return { display, animate };
}

function groundSprite(piece: GroundPiece, origin: PlacedPlanet): Sprite {
  const figure = sprite(detailUnitTexture(piece.type, piece.seat), GROUND_SIZE);
  figure.position.set(piece.x - origin.x, piece.y - origin.y);
  return figure;
}

/** Raumdock: ein Ring aus Stationsmodulen, der den Planeten umkreist. */
function dockRing(placed: PlacedPlanet, seat: number) {
  const ring = new Container();
  const rx = placed.size * 0.66;
  const ry = placed.size * 0.2;
  const color = seatHex(seat);
  ring.addChild(new Graphics().ellipse(0, 0, rx, ry).stroke({ width: 3, color, alpha: 0.7 }));
  const pods = Array.from({ length: 8 }, () => {
    const pod = new Graphics().roundRect(-7, -4, 14, 8, 2).fill({ color });
    ring.addChild(pod);
    return pod;
  });
  const animate = (time: number) =>
    pods.forEach((pod, index) => {
      const angle = time * 0.0004 + (index / pods.length) * Math.PI * 2;
      pod.position.set(Math.cos(angle) * rx, Math.sin(angle) * ry);
      pod.zIndex = Math.sin(angle) > 0 ? 3 : 0;
    });
  return { ring, animate };
}

function planetBody(placed: PlacedPlanet): Container {
  const body = new Container();
  const { planet, size } = placed;
  body.addChild(glow(0x9fd0ff, size * 1.7, 0.18));
  const surface = sprite(detailPlanetTexture(planet.id, planet.look), size * ATMOSPHERE);
  if (planet.exhausted) surface.tint = 0x7a7a8a;
  body.addChild(surface);
  if (planet.controllerSeat !== null)
    body.addChild(
      new Graphics()
        .circle(0, 0, size * 0.52)
        .stroke({ width: 4, color: seatHex(planet.controllerSeat), alpha: 0.85 }),
    );
  body.zIndex = 1;
  return body;
}

function moon(placed: PlacedPlanet) {
  const figure = sprite(detailPlanetTexture(`${placed.planet.id}-mond`, 'plain'), MOON_SIZE);
  const animate = (time: number) => {
    const angle = time * 0.0005 + placed.size;
    figure.position.set(Math.cos(angle) * placed.size * 0.78, Math.sin(angle) * placed.size * 0.3);
    figure.zIndex = Math.sin(angle) > 0 ? 2 : 0;
  };
  return { figure, animate };
}

export function planetPiece(placed: PlacedPlanet): Piece {
  const display = new Container();
  display.sortableChildren = true;
  display.position.set(placed.x, placed.y);
  const satellite = moon(placed);
  display.addChild(planetBody(placed), satellite.figure);
  for (const piece of placed.ground) display.addChild(groundSprite(piece, placed)).zIndex = 4;
  const dock = placed.dockSeat === null ? null : dockRing(placed, placed.dockSeat);
  if (dock !== null) display.addChild(...dock.ring.removeChildren());
  const animate = (time: number) => {
    satellite.animate(time);
    dock?.animate(time);
  };
  return { display, animate };
}

function shipFigure(ship: PlacedShip, phase: number): Piece {
  const display = new Container();
  display.position.set(ship.x, ship.y);
  const width = SHIP_WIDTH * ship.scale;
  const flame = glow(0x7fe3ff, width * 0.5, 0.8);
  flame.position.set(-ship.facing * width * 0.48, 0);
  const hull = sprite(detailUnitTexture(ship.type, ship.seat), width, width * SHIP_ASPECT);
  hull.scale.x *= ship.facing;
  display.addChild(flame, hull);
  const animate = (time: number) => {
    display.y = ship.y + Math.sin(time * 0.0014 + phase) * 5;
    flame.alpha = 0.6 + 0.3 * Math.sin(time * 0.02 + phase * 3);
  };
  return { display, animate };
}

function fighterSwarm(fleet: Fleet): Piece {
  const display = new Container();
  const fighters = Array.from({ length: Math.min(fleet.fighters, 10) }, (_, index) => {
    const figure = sprite(detailUnitTexture('fighter', fleet.seat), FIGHTER_WIDTH);
    display.addChild(figure);
    return { figure, offset: (index / Math.max(1, fleet.fighters)) * Math.PI * 2 };
  });
  const animate = (time: number) => {
    for (const { figure, offset } of fighters) {
      const angle = time * 0.0007 + offset;
      const { rx, ry } = FIGHTER_ORBIT;
      figure.position.set(fleet.x + Math.cos(angle) * rx, fleet.y + Math.sin(angle) * ry);
      figure.rotation = Math.atan2(Math.cos(angle) * ry, -Math.sin(angle) * rx);
    }
  };
  return { display, animate };
}

export function fleetPiece(fleet: Fleet): Piece {
  const display = new Container();
  const parts = [
    ...fleet.ships.map((ship, index) => shipFigure(ship, index * 1.7)),
    fighterSwarm(fleet),
  ];
  for (const part of parts) display.addChild(part.display);
  return { display, animate: (time) => parts.forEach((part) => part.animate(time)) };
}

export function wormholePiece(kind: 'alpha' | 'beta', x: number, y: number): Piece {
  const display = new Container();
  display.position.set(x, y);
  const color = kind === 'alpha' ? 0xffb347 : 0x4fe0d0;
  const rings = new Container();
  for (const radius of [26, 44, 62])
    rings.addChild(
      new Graphics()
        .arc(0, 0, radius, 0, Math.PI * 1.4)
        .stroke({ width: 5, color, alpha: 1 - radius / 90 }),
    );
  display.addChild(glow(color, 220, 0.55), rings);
  return { display, animate: (time) => (rings.rotation = time * 0.0015) };
}
