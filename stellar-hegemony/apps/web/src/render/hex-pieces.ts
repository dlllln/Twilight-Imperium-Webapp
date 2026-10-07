import { Container, Graphics, Sprite } from 'pixi.js';
import { GOLD } from './palette.ts';
import type { ScenePlanet, UnitCount } from './scene-model.ts';
import { COUNT_STYLE, INFLUENCE_STYLE, label, RESOURCE_STYLE } from './text-styles.ts';
import { hexOf } from './palette.ts';
import { seatColor } from '../seat-colors.ts';
import { planetTexture, unitTexture } from './textures.ts';

export interface Spot {
  readonly x: number;
  readonly y: number;
}

/** Planetenplätze relativ zur Feldmitte, je nach Anzahl (unten bleibt Platz für Flotten). */
const PLANET_SPOTS: readonly (readonly Spot[])[] = [
  [],
  [{ x: 0, y: -6 }],
  [
    { x: -18, y: -12 },
    { x: 17, y: 4 },
  ],
  [
    { x: -21, y: -15 },
    { x: 19, y: -17 },
    { x: 0, y: 12 },
  ],
];
const PLANET_DIAMETERS = [0, 34, 27, 22];
const CENTER_DIAMETER = 42;
const ATMOSPHERE = 1.15;
const TECH_COLORS: Readonly<Record<string, number>> = {
  biotic: 0x4caf50,
  propulsion: 0x42a5f5,
  cybernetic: 0xfdd835,
  warfare: 0xef5350,
};

export const planetSpots = (count: number): readonly Spot[] =>
  PLANET_SPOTS[count] ?? PLANET_SPOTS[PLANET_SPOTS.length - 1] ?? [];

export const planetDiameter = (planet: ScenePlanet, count: number): number =>
  planet.look === 'center' ? CENTER_DIAMETER : (PLANET_DIAMETERS[count] ?? CENTER_DIAMETER / 2);

const seatHex = (seat: number): number => hexOf(seatColor(seat));

function planetBody(planet: ScenePlanet, diameter: number): Sprite {
  const body = new Sprite(planetTexture(planet.id, planet.look));
  body.anchor.set(0.5);
  body.width = diameter * ATMOSPHERE;
  body.height = diameter * ATMOSPHERE;
  if (planet.exhausted) body.tint = 0x5a5a6a;
  return body;
}

function planetValues(planet: ScenePlanet, diameter: number): Container {
  const values = new Container();
  const y = diameter / 2 + 6;
  values.addChild(
    label(String(planet.definition.resources), RESOURCE_STYLE, -5, y),
    label(String(planet.definition.influence), INFLUENCE_STYLE, 5, y),
  );
  return values;
}

function techDot(specialty: string, radius: number): Graphics {
  const offset = radius * 0.78;
  return new Graphics()
    .circle(offset, -offset, 3)
    .fill(TECH_COLORS[specialty] ?? GOLD)
    .stroke({ width: 0.8, color: 0x000000 });
}

/** Kleine Figuren neben dem Planeten: Bodentruppen und Bauwerke des Besitzers. */
function groundUnits(units: readonly UnitCount[], radius: number): Container {
  const stack = new Container();
  units.forEach((unit, index) => {
    const icon = new Sprite(unitTexture(unit.type, unit.seat));
    icon.anchor.set(0.5);
    icon.setSize(10, 10);
    icon.position.set(radius + 6, -radius / 2 + index * 10);
    stack.addChild(icon);
    if (unit.count > 1) stack.addChild(label(String(unit.count), COUNT_STYLE, radius + 13, icon.y));
  });
  return stack;
}

/** Planet mit Werten, Spezialisierung und Truppen; der Kontrollring kommt in die Glühebene. */
export function planetPiece(planet: ScenePlanet, diameter: number, at: Spot): Container {
  const piece = new Container();
  piece.position.set(at.x, at.y);
  piece.addChild(planetBody(planet, diameter), planetValues(planet, diameter));
  const specialty = planet.definition.technologySpecialty;
  if (specialty !== undefined) piece.addChild(techDot(specialty, diameter / 2));
  piece.addChild(groundUnits(planet.units, diameter / 2));
  return piece;
}

export function controlRing(seat: number, diameter: number, at: Spot): Graphics {
  return new Graphics()
    .circle(at.x, at.y, diameter / 2 + 2.5)
    .stroke({ width: 1.6, color: seatHex(seat), alpha: 0.95 });
}

const SHIP_ROW_Y = 33;
const SHIP_SPACING = 24;
const SHIPS_PER_ROW = 3;

function shipIcon(unit: UnitCount, x: number, y: number): Container {
  const icon = new Container();
  const fighter = unit.type === 'fighter';
  const sprite = new Sprite(unitTexture(unit.type, unit.seat));
  sprite.anchor.set(0.5);
  sprite.setSize(fighter ? 14 : 24, fighter ? 9 : 15);
  icon.position.set(x, y);
  icon.addChild(sprite);
  if (unit.count > 1) icon.addChild(label(String(unit.count), COUNT_STYLE, 9, 6));
  return icon;
}

/** Flotten als Reihen kleiner Miniaturen am unteren Feldrand, gruppiert nach Spieler und Typ. */
export function shipRows(ships: readonly UnitCount[]): Container {
  const rows = new Container();
  ships.forEach((unit, index) => {
    const row = Math.floor(index / SHIPS_PER_ROW);
    const inRow = Math.min(SHIPS_PER_ROW, ships.length - row * SHIPS_PER_ROW);
    const column = index % SHIPS_PER_ROW;
    const x = (column - (inRow - 1) / 2) * SHIP_SPACING;
    rows.addChild(shipIcon(unit, x, SHIP_ROW_Y + row * 13));
  });
  return rows;
}

const TOKEN_Y = -40;
const TOKEN_SPACING = 12;

/** Kommandomarker als Chips in Spielerfarbe mit goldenem Rand. */
export function tokenChips(seats: readonly number[]): Graphics {
  const chips = new Graphics();
  seats.forEach((seat, index) => {
    const x = (index - (seats.length - 1) / 2) * TOKEN_SPACING;
    chips.circle(x, TOKEN_Y, 5).fill(seatHex(seat)).stroke({ width: 1.2, color: GOLD });
    chips.circle(x, TOKEN_Y, 2.2).fill({ color: 0x000000, alpha: 0.35 });
  });
  return chips;
}
