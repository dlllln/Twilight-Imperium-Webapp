import { SHIP_SCALE, WORLD } from '../system/system-layout.ts';

/*
 * Aufstellung der Kampfbühne als reine Daten. Wie die Systemansicht nutzt sie eine gedachte
 * Bühne von 1600 × 1000 mit dem Ursprung in der Mitte: links der Verteidiger, rechts der
 * Angreifer, Jäger als Staffel darüber, unten liegen die Planeten.
 */

export interface BattleShip {
  readonly id: string;
  readonly type: string;
  readonly seat: number;
  readonly damaged: boolean;
}

export interface BattleSide {
  readonly seat: number;
  readonly ships: readonly BattleShip[];
}

export interface ShipSpot extends BattleShip {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /** Links stehende Schiffe blicken nach rechts (1), rechts stehende nach links (-1). */
  readonly facing: 1 | -1;
}

/** Bildausschnitt: Größe des sichtbaren Bereichs und seine Mitte in der Höhe. */
export interface BattleFrame {
  readonly width: number;
  readonly height: number;
  readonly centerY: number;
}

/** Die ganze Bühne (Simulator) oder eng um die Flotten (Kampfansicht der Partie). */
export const FULL_FRAME: BattleFrame = { ...WORLD, centerY: 0 };
export const FLEET_FRAME: BattleFrame = { width: 1400, height: 660, centerY: -60 };

const CAPITAL = { x: 230, y: 40, gapX: 150, gapY: 96, rows: 4 } as const;
const SQUADRON = { x: 200, y: -290, gapX: 58, gapY: 46, rows: 3 } as const;
/** Jede zweite Reihe rückt etwas vor, damit die Formation lebendig wirkt. */
const STAGGER = 36;
const FIGHTER_SCALE = 0.4;
const RANK = ['sunbreaker', 'dreadnought', 'cruiser', 'carrier', 'destroyer'];

const rank = (type: string): number => {
  const index = RANK.indexOf(type);
  return index === -1 ? RANK.length : index;
};

type Grid = typeof CAPITAL | typeof SQUADRON;

/** Spalten von vorn nach hinten, Reihen um die Mitte der Gruppe verteilt. */
function place(
  ships: readonly BattleShip[],
  grid: Grid,
  facing: 1 | -1,
  scaleOf: (s: string) => number,
) {
  return ships.map((ship, index): ShipSpot => {
    const column = Math.floor(index / grid.rows);
    const row = (index % grid.rows) - (Math.min(ships.length, grid.rows) - 1) / 2;
    const ahead = row % 2 === 0 ? 0 : STAGGER;
    return {
      ...ship,
      x: -facing * (grid.x + column * grid.gapX - ahead),
      y: grid.y + row * grid.gapY,
      scale: scaleOf(ship.type),
      facing,
    };
  });
}

function sideSpots(side: BattleSide, facing: 1 | -1): readonly ShipSpot[] {
  const fighters = side.ships.filter((ship) => ship.type === 'fighter');
  const capitals = side.ships
    .filter((ship) => ship.type !== 'fighter')
    .sort((a, b) => rank(a.type) - rank(b.type));
  return [
    ...place(capitals, CAPITAL, facing, (type) => SHIP_SCALE[type] ?? 1),
    ...place(fighters, SQUADRON, facing, () => FIGHTER_SCALE),
  ];
}

/** Alle Schiffe beider Seiten mit Position, Größe und Blickrichtung. */
export const battleLayout = (left: BattleSide, right: BattleSide): readonly ShipSpot[] => [
  ...sideSpots(left, 1),
  ...sideSpots(right, -1),
];
