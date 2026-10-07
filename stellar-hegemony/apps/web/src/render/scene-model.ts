import { planetName } from '@stellar/content';
import type {
  AnomalyKind,
  ContentPort,
  GameState,
  Hex,
  MapLayout,
  PlanetDefinition,
  PlanetState,
  SystemState,
  SystemTile,
  TileBack,
  Unit,
  WormholeKind,
} from '@stellar/domain';
import type { Language } from '../i18n.ts';
import type { PlanetLook } from './planet-texture.ts';

/** Gleichartige Einheiten eines Sitzplatzes, z. B. „Sitz 2: 3 Kreuzer“. */
export interface UnitCount {
  readonly type: string;
  readonly seat: number;
  readonly count: number;
}

export interface ScenePlanet {
  readonly id: string;
  readonly name: string;
  readonly definition: PlanetDefinition;
  readonly look: PlanetLook;
  readonly controllerSeat: number | null;
  readonly exhausted: boolean;
  readonly units: readonly UnitCount[];
}

export type Highlight = 'none' | 'active' | 'selected' | 'origin';

/** Alles, was ein Hexfeld zum Zeichnen braucht (unabhängig von Pixi). */
export interface SceneHex {
  readonly key: string;
  readonly position: Hex;
  readonly kind: 'system' | 'homeSlot';
  readonly systemId: string | null;
  readonly back: TileBack;
  readonly anomaly?: AnomalyKind;
  readonly wormholes: readonly WormholeKind[];
  /** Sitz (1-basiert) für Heimat-Plätze und Heimatsysteme. */
  readonly seat: number | null;
  readonly planets: readonly ScenePlanet[];
  readonly ships: readonly UnitCount[];
  readonly tokens: readonly number[];
  readonly highlight: Highlight;
}

export const hexKey = (position: Hex): string => `${String(position.q)},${String(position.r)}`;

const lookOf = (planet: PlanetDefinition, back: TileBack): PlanetLook =>
  back === 'center' ? 'center' : (planet.trait ?? 'plain');

/** Zählt Einheiten je Sitz und Typ, sortiert nach Sitz. */
export function countUnits(
  units: readonly Unit[],
  seatOf: (unit: Unit) => number,
): readonly UnitCount[] {
  const counts = new Map<string, UnitCount>();
  for (const unit of units) {
    const seat = seatOf(unit);
    const key = `${String(seat)}:${unit.type}`;
    const known = counts.get(key);
    counts.set(key, { type: unit.type, seat, count: (known?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => a.seat - b.seat);
}

type SeatOf = (player: string | null) => number | null;

const NO_SEAT: SeatOf = () => null;
const unitSeat = (seatOf: SeatOf) => (unit: Unit) => seatOf(unit.owner) ?? 0;
const nameOf = (id: string, language: Language) => planetName(id)?.[language] ?? id;

function scenePlanet(
  definition: PlanetDefinition,
  back: TileBack,
  language: Language,
  planet: PlanetState | undefined,
  seatOf: SeatOf,
): ScenePlanet {
  return {
    id: definition.id,
    name: nameOf(definition.id, language),
    definition,
    look: lookOf(definition, back),
    controllerSeat: seatOf(planet?.controller ?? null),
    exhausted: planet?.exhausted === true,
    units: countUnits(planet?.units ?? [], unitSeat(seatOf)),
  };
}

const tileFields = (tile: SystemTile) => ({
  systemId: tile.id,
  back: tile.back,
  wormholes: tile.wormholes,
  ...(tile.anomaly === undefined ? {} : { anomaly: tile.anomaly }),
});

const EMPTY = { ships: [], tokens: [], highlight: 'none' } as const;

const homeSlotHex = (position: Hex, seat: number): SceneHex => ({
  ...EMPTY,
  key: hexKey(position),
  position,
  kind: 'homeSlot',
  systemId: null,
  back: 'home',
  wormholes: [],
  seat,
  planets: [],
});

function layoutSystemHex(position: Hex, tile: SystemTile, language: Language): SceneHex {
  const planets = tile.planets.map((planet) =>
    scenePlanet(planet, tile.back, language, undefined, NO_SEAT),
  );
  return {
    ...EMPTY,
    key: hexKey(position),
    position,
    kind: 'system',
    seat: null,
    planets,
    ...tileFields(tile),
  };
}

/** Aufbau-Ansicht: Galaxie aus dem Layout, noch ohne Einheiten. */
export function layoutScene(
  layout: MapLayout,
  content: ContentPort,
  language: Language,
): readonly SceneHex[] {
  let seat = 0;
  return layout.flatMap((slot): SceneHex[] => {
    if (slot.content.kind === 'home') return [homeSlotHex(slot.position, ++seat)];
    const tile = content.tiles.find(slot.content.tileId);
    return tile === undefined ? [] : [layoutSystemHex(slot.position, tile, language)];
  });
}

interface GameLookup {
  readonly game: GameState;
  readonly content: ContentPort;
  readonly language: Language;
  readonly seatOf: SeatOf;
  readonly highlights: ReadonlyMap<string, Highlight>;
}

function homeSeat(lookup: GameLookup, system: SystemState): number | null {
  const faction = lookup.content.factions.find((f) => f.homeSystem.id === system.id);
  const player = lookup.game.players.find((candidate) => candidate.faction === faction?.id);
  return player === undefined ? null : player.seat + 1;
}

function gameHex(lookup: GameLookup, system: SystemState, tile: SystemTile): SceneHex {
  const { game, language, seatOf } = lookup;
  const planets = tile.planets.map((planet) =>
    scenePlanet(planet, tile.back, language, game.planets[planet.id], seatOf),
  );
  return {
    ...tileFields(tile),
    key: hexKey(system.position),
    position: system.position,
    kind: 'system',
    seat: homeSeat(lookup, system),
    planets,
    ships: countUnits(system.spaceUnits, unitSeat(seatOf)),
    tokens: system.commandTokens.flatMap((player) => seatOf(player) ?? []),
    highlight: lookup.highlights.get(system.id) ?? 'none',
  };
}

const seatLookup =
  (game: GameState): SeatOf =>
  (id) => {
    const player = game.players.find((candidate) => candidate.id === id);
    return player === undefined ? null : player.seat + 1;
  };

/** Spiel-Ansicht: Systeme mit Planetenkontrolle, Flotten und Kommandomarkern. */
export function gameScene(
  game: GameState,
  content: ContentPort,
  language: Language,
  highlights: ReadonlyMap<string, Highlight> = new Map(),
): readonly SceneHex[] {
  const lookup = { game, content, language, highlights, seatOf: seatLookup(game) };
  return Object.values(game.systems).flatMap((system) => {
    const tile = content.tiles.find(system.id);
    return tile === undefined ? [] : [gameHex(lookup, system, tile)];
  });
}
