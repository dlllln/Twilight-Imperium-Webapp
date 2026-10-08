import type { AnomalyKind, WormholeKind } from '@stellar/domain';
import { hashString } from '../render/noise.ts';
import type { SceneHex, ScenePlanet, UnitCount } from '../render/scene-model.ts';

/*
 * Aufbau der Systemansicht als reine Daten: Stern, Planetenbahnen, Flotten, Bodentruppen.
 * Koordinaten liegen in einer gedachten Bühne von WORLD.width × WORLD.height mit dem
 * Ursprung in der Mitte; Pixi-Szene und Beschriftungen rechnen beide damit.
 */
export const WORLD = { width: 1600, height: 1000 } as const;

export type CentralBody = 'star' | 'supernova' | 'rift' | 'distant';

export interface Placed {
  readonly x: number;
  readonly y: number;
}

export interface GroundPiece extends Placed {
  readonly type: string;
  readonly seat: number;
}

export interface PlacedPlanet extends Placed {
  readonly planet: ScenePlanet;
  readonly size: number;
  readonly orbit: { readonly rx: number; readonly ry: number };
  readonly ground: readonly GroundPiece[];
  /** Sitz, dessen Raumdock den Planeten umkreist. */
  readonly dockSeat: number | null;
}

export interface PlacedShip extends Placed {
  readonly type: string;
  readonly seat: number;
  readonly scale: number;
  /** Schiffe links blicken nach rechts und umgekehrt. */
  readonly facing: 1 | -1;
}

export interface Fleet extends Placed {
  readonly seat: number;
  readonly ships: readonly PlacedShip[];
  readonly fighters: number;
  readonly counts: readonly UnitCount[];
}

export interface SystemLayout {
  readonly central: CentralBody;
  readonly star: Placed & { readonly radius: number; readonly hue: number };
  readonly backdrop: AnomalyKind | 'space';
  readonly planets: readonly PlacedPlanet[];
  readonly fleets: readonly Fleet[];
  readonly wormholes: readonly (Placed & { readonly kind: WormholeKind })[];
  readonly tokens: readonly number[];
}

const STAR_Y = -150;
const ORBIT_FIRST = 330;
const ORBIT_STEP = 190;
const ORBIT_TILT = 0.36;
/** Bahnposition je Planet (Anteil eines halben Umlaufs): abwechselnd seitlich, damit der Stern frei bleibt. */
const ORBIT_SLOTS = [0.12, 0.84, 0.32, 0.64] as const;
const SLOT_JITTER = 0.04;
const PLANET_BASE = 130;
const PLANET_PER_VALUE = 14;
const FLEET_Y = 285;
const FLEET_SPREAD = 560;
/** Mehr Figuren je Typ würden die Bühne überladen; der Rest steht als Zahl daneben. */
export const MAX_SHIPS_PER_TYPE = 6;

const SHIP_ORDER = ['sunbreaker', 'dreadnought', 'carrier', 'cruiser', 'destroyer'];
export const SHIP_SCALE: Readonly<Record<string, number>> = {
  sunbreaker: 1.5,
  dreadnought: 1.25,
  carrier: 1.1,
  cruiser: 0.95,
  destroyer: 0.8,
};
const SHIP_GAP = { x: 200, y: 86 } as const;
/** Keil: die mittlere Reihe fliegt voraus. */
const WEDGE = 60;
const ROWS = 3;

const STAR_RADIUS: Readonly<Record<CentralBody, number>> = {
  star: 110,
  supernova: 210,
  rift: 120,
  distant: 26,
};

function centralBody(hex: SceneHex): CentralBody {
  if (hex.anomaly === 'supernova') return 'supernova';
  if (hex.anomaly === 'gravityRift') return 'rift';
  return hex.planets.length > 0 ? 'star' : 'distant';
}

/** Winkel auf der vorderen Bahnhälfte, je Planet leicht versetzt. */
function angleFor(index: number, seed: number): number {
  const slot = ORBIT_SLOTS[index % ORBIT_SLOTS.length] ?? 0;
  const jitter = ((seed % 100) / 100 - 0.5) * 2 * SLOT_JITTER;
  return (slot + jitter) * Math.PI;
}

/** Bodentruppen und Bauten stehen im Bogen am unteren Planetenrand. */
const GROUND_STEP = 0.3;

function groundOf(planet: ScenePlanet, x: number, y: number, size: number): GroundPiece[] {
  const pieces = planet.units
    .filter((unit) => unit.type !== 'orbitalDock')
    .flatMap((unit) =>
      Array.from({ length: Math.min(unit.count, MAX_SHIPS_PER_TYPE) }, () => unit),
    );
  const middle = (pieces.length - 1) / 2;
  return pieces.map((unit, index) => {
    const angle = Math.PI / 2 + (index - middle) * GROUND_STEP;
    return {
      type: unit.type,
      seat: unit.seat,
      x: x + Math.cos(angle) * size * 0.46,
      y: y + Math.sin(angle) * size * 0.46,
    };
  });
}

function placePlanet(planet: ScenePlanet, index: number): PlacedPlanet {
  const rx = ORBIT_FIRST + ORBIT_STEP * index;
  const ry = rx * ORBIT_TILT;
  const angle = angleFor(index, hashString(planet.id));
  const x = Math.cos(angle) * rx;
  const y = STAR_Y + Math.sin(angle) * ry;
  const value = planet.definition.resources + planet.definition.influence;
  const size = PLANET_BASE + PLANET_PER_VALUE * value;
  const dock = planet.units.find((unit) => unit.type === 'orbitalDock');
  return {
    planet,
    x,
    y,
    size,
    orbit: { rx, ry },
    ground: groundOf(planet, x, y, size),
    dockSeat: dock?.seat ?? null,
  };
}

const shipRank = (type: string): number => {
  const rank = SHIP_ORDER.indexOf(type);
  return rank === -1 ? SHIP_ORDER.length : rank;
};

/** Einzelne Figuren einer Flotte, die größten vorn; je Typ höchstens MAX_SHIPS_PER_TYPE. */
function shipFigures(counts: readonly UnitCount[]): UnitCount[] {
  return counts
    .filter((unit) => unit.type !== 'fighter')
    .sort((a, b) => shipRank(a.type) - shipRank(b.type))
    .flatMap((unit) =>
      Array.from({ length: Math.min(unit.count, MAX_SHIPS_PER_TYPE) }, () => unit),
    );
}

/** Keilformation: Spalten zu je ROWS Schiffen, die erste Spalte zeigt zur Mitte. */
function formation(counts: readonly UnitCount[], center: Placed, facing: 1 | -1): PlacedShip[] {
  return shipFigures(counts).map((unit, index) => {
    const column = Math.floor(index / ROWS);
    const row = (index % ROWS) - (ROWS - 1) / 2;
    return {
      type: unit.type,
      seat: unit.seat,
      scale: SHIP_SCALE[unit.type] ?? 1,
      facing,
      x: center.x - facing * (column * SHIP_GAP.x + Math.abs(row) * WEDGE),
      y: center.y + row * SHIP_GAP.y + column * (SHIP_GAP.y / 3),
    };
  });
}

/** Flotten je Sitz nebeneinander; links stehende blicken nach rechts, rechts stehende nach links. */
function placeFleets(ships: readonly UnitCount[]): Fleet[] {
  const seats = [...new Set(ships.map((unit) => unit.seat))];
  return seats.map((seat, index) => {
    const t = seats.length === 1 ? 0 : index / (seats.length - 1) - 0.5;
    const center = { x: t * FLEET_SPREAD * 2, y: FLEET_Y };
    const facing: 1 | -1 = t > 0 ? -1 : 1;
    const counts = ships.filter((unit) => unit.seat === seat);
    const fighters = counts.find((unit) => unit.type === 'fighter')?.count ?? 0;
    return { seat, ...center, counts, fighters, ships: formation(counts, center, facing) };
  });
}

const WORMHOLE_SPOTS: readonly Placed[] = [
  { x: 600, y: -330 },
  { x: -600, y: -330 },
];

function placeWormholes(kinds: readonly WormholeKind[]) {
  return kinds.map((kind, index) => ({ kind, ...(WORMHOLE_SPOTS[index] ?? { x: 0, y: 0 }) }));
}

/** Die ganze Bühne eines Systems; rein aus der Szene, ohne Pixi oder DOM. */
export function systemLayout(hex: SceneHex): SystemLayout {
  const central = centralBody(hex);
  const seed = hashString(hex.key);
  return {
    central,
    star: { x: 0, y: STAR_Y, radius: STAR_RADIUS[central], hue: seed % 360 },
    backdrop: hex.anomaly ?? 'space',
    planets: hex.planets.map((planet, index) => placePlanet(planet, index)),
    fleets: placeFleets(hex.ships),
    wormholes: placeWormholes(hex.wormholes),
    tokens: hex.tokens,
  };
}

/** Maßstab, mit dem die Bühne in eine Fläche passt (wie „contain“). */
export const fitScale = (width: number, height: number): number =>
  Math.min(width / WORLD.width, height / WORLD.height);
