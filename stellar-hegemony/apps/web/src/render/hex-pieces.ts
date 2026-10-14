import { Container, Graphics, type Mesh, type MeshGeometry, type Shader, Sprite } from 'pixi.js';
import { planetMesh } from './planet-mesh.ts';
import { GOLD } from './palette.ts';
import type { ScenePlanet, UnitCount } from './scene-model.ts';
import { COUNT_STYLE, INFLUENCE_STYLE, label, RESOURCE_STYLE } from './text-styles.ts';
import { hexOf } from './palette.ts';
import { seatColor } from '../seat-colors.ts';
import { unitTexture } from './textures.ts';
import type { Projected } from './board-view.ts';

const EXHAUSTED_TINT = 0x5a5a6a;
const TECH_COLORS: Readonly<Record<string, number>> = {
  biotic: 0x4caf50,
  propulsion: 0x42a5f5,
  cybernetic: 0xfdd835,
  warfare: 0xef5350,
};

const seatHex = (seat: number): number => hexOf(seatColor(seat));

/** Planet als Shader-Fläche: scharf in jeder Zoomstufe. */
function planetBody(planet: ScenePlanet, diameter: number): Mesh<MeshGeometry, Shader> {
  const body = planetMesh(planet.id, planet.look, diameter);
  if (planet.exhausted) body.tint = EXHAUSTED_TINT;
  return body;
}

/** Ressourcen und Einfluss unter dem Planeten; beim Nahzoom übernimmt die Beschriftung im DOM. */
function planetValues(planet: ScenePlanet, diameter: number, labels: Container): void {
  const y = diameter / 2 + 7;
  labels.addChild(
    valueBadge(y),
    label(String(planet.definition.resources), RESOURCE_STYLE, -BADGE_HALF / 2, y),
    label(String(planet.definition.influence), INFLUENCE_STYLE, BADGE_HALF / 2, y),
  );
}

const BADGE_HALF = 12;
const BADGE_HEIGHT = 12;

/** Dunkles Schildchen mit Trennstrich: links Ressourcen (gold), rechts Einfluss (blau). */
function valueBadge(y: number): Graphics {
  const top = y - BADGE_HEIGHT / 2;
  return new Graphics()
    .roundRect(-BADGE_HALF, top, BADGE_HALF * 2, BADGE_HEIGHT, BADGE_HEIGHT / 2)
    .fill({ color: 0x060a18, alpha: 0.82 })
    .stroke({ width: 0.7, color: GOLD, alpha: 0.6 })
    .moveTo(0, top + 2.5)
    .lineTo(0, top + BADGE_HEIGHT - 2.5)
    .stroke({ width: 0.6, color: 0xffffff, alpha: 0.3 });
}

function techDot(specialty: string, radius: number): Graphics {
  const offset = radius * 0.78;
  return new Graphics()
    .circle(offset, -offset, 3)
    .fill(TECH_COLORS[specialty] ?? GOLD)
    .stroke({ width: 0.8, color: 0x000000 });
}

/** Kleine Figuren neben dem Planeten: Bodentruppen und Bauwerke; Zahlen gehen in `labels`. */
function groundUnits(units: readonly UnitCount[], radius: number, labels: Container) {
  const stack = new Container();
  units.forEach((unit, index) => {
    const icon = new Sprite(unitTexture(unit.type, unit.seat));
    icon.anchor.set(0.5);
    icon.setSize(10, 10);
    icon.position.set(radius + 6, -radius / 2 + index * 10);
    stack.addChild(dropShadow(icon, GROUND_LIFT), icon);
    if (unit.count > 1)
      labels.addChild(label(String(unit.count), COUNT_STYLE, radius + 13, icon.y));
  });
  return stack;
}

/** Größe und Deckkraft der Schattenringe, von außen nach innen. */
const SHADOW_RINGS: readonly (readonly [number, number])[] = [
  [1.1, 0.16],
  [0.95, 0.22],
  [0.8, 0.3],
];

/** Weicher, flach liegender Schatten unter dem schwebenden Planeten (leicht nach rechts unten). */
export function planetShadow(diameter: number): Graphics {
  const shadow = new Graphics();
  for (const [scale, alpha] of SHADOW_RINGS)
    shadow
      .circle(diameter * 0.1, diameter * 0.08, (diameter / 2) * scale)
      .fill({ color: 0x000000, alpha });
  return shadow;
}

/** Figur und Zahlen eines Stücks, beide um seinen Standpunkt herum gezeichnet. */
export interface Figure {
  readonly body: Container;
  readonly labels: Container;
}

/** Planet mit Spezialisierung und Truppen; Werte und Anzahlen kommen in `labels`. */
export function planetPiece(planet: ScenePlanet, diameter: number): Figure {
  const body = new Container();
  const labels = new Container();
  body.addChild(planetBody(planet, diameter));
  const specialty = planet.definition.technologySpecialty;
  if (specialty !== undefined) body.addChild(techDot(specialty, diameter / 2));
  body.addChild(groundUnits(planet.units, diameter / 2, labels));
  planetValues(planet, diameter, labels);
  return { body, labels };
}

/** Kontrollring um einen Planeten in Bildkoordinaten (Mitte und Maßstab der Figur). */
export function controlRing(
  graphics: Graphics,
  seat: number,
  at: Projected,
  radius: number,
  line: number,
): void {
  graphics
    .circle(at.x, at.y, (radius + 2.5 * line) * at.scale)
    .stroke({ width: 1.6 * line * at.scale, color: seatHex(seat), alpha: 0.95 });
}

/** Dieselbe Figur dunkel und versetzt: Schlagschatten der schwebenden Miniatur. */
export function dropShadow(sprite: Sprite, lift: number): Sprite {
  const shadow = new Sprite(sprite.texture);
  shadow.anchor.set(0.5);
  shadow.setSize(sprite.width, sprite.height);
  shadow.position.set(sprite.x + lift * 0.5, sprite.y + lift);
  shadow.tint = 0x000000;
  shadow.alpha = 0.55;
  return shadow;
}

const SHIP_LIFT = 5;
const GROUND_LIFT = 2;

/** Schiffsgruppe als Miniatur mit Schatten; die Anzahl steht in `labels`. */
export function shipPiece(unit: UnitCount): Figure {
  const body = new Container();
  const labels = new Container();
  const fighter = unit.type === 'fighter';
  const sprite = new Sprite(unitTexture(unit.type, unit.seat));
  sprite.anchor.set(0.5);
  sprite.setSize(fighter ? 14 : 24, fighter ? 9 : 15);
  body.addChild(dropShadow(sprite, SHIP_LIFT), sprite);
  if (unit.count > 1) labels.addChild(label(String(unit.count), COUNT_STYLE, 9, 6));
  return { body, labels };
}

const TOKEN_SPACING = 12;
const TOKEN_THICKNESS = 1.8;

/** Kommandomarker als Chips in Spielerfarbe mit goldenem Rand und Dicke, um ihren Standpunkt. */
export function tokenChips(seats: readonly number[]): Graphics {
  const chips = new Graphics();
  seats.forEach((seat, index) => {
    const x = (index - (seats.length - 1) / 2) * TOKEN_SPACING;
    chips.circle(x, TOKEN_THICKNESS, 5).fill(0x1a1408);
    chips.circle(x, 0, 5).fill(seatHex(seat)).stroke({ width: 1.2, color: GOLD });
    chips.circle(x, 0, 2.2).fill({ color: 0x000000, alpha: 0.35 });
  });
  return chips;
}
