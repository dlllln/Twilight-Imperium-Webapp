import { planetName } from '@stellar/content';
import {
  type AnomalyKind,
  type ContentPort,
  type GameState,
  type Hex,
  type MapLayout,
  type PlanetDefinition,
  type PlanetState,
  type SystemState,
  type SystemTile,
  type TileBack,
  type Unit,
  withAttachments,
  type WormholeKind,
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
  /** PoK Anlagen: Kennungen der Erkundungskarten, die am Planeten liegen. */
  readonly attachments: readonly string[];
  /** Legendärer Planet: Fähigkeit bereit oder in dieser Runde schon genutzt; sonst `null`. */
  readonly legendary: 'ready' | 'used' | null;
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
  /** Sitz (1-basiert), dem allein Schiffe oder Planeten im System gehören; sonst `null`. */
  readonly control: number | null;
  /** PoK Grenzmarker, der noch auf Erkundung wartet. */
  readonly frontier: boolean;
  /** Handelswaren in einem Depot, die Schiffe abholen können. */
  readonly cache: number;
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

/** Was der Planet in der Partie mitbringt; im Aufbau ist er unberührt. */
interface PlanetSituation {
  readonly language: Language;
  readonly seatOf: SeatOf;
  readonly planet?: PlanetState | undefined;
  readonly usedLegendaries?: readonly string[];
}

const legendaryOf = (definition: PlanetDefinition, used: readonly string[]) => {
  if (definition.legendary === undefined) return null;
  return used.includes(definition.id) ? 'used' : 'ready';
};

/** Was der Planet in der Partie trägt: Besitzer, Erschöpfung, Truppen, Anlagen. */
function planetCondition(planet: PlanetState | undefined, seatOf: SeatOf) {
  if (planet === undefined)
    return { controllerSeat: null, exhausted: false, units: [], attachments: [] };
  return {
    controllerSeat: seatOf(planet.controller),
    exhausted: planet.exhausted,
    units: countUnits(planet.units, unitSeat(seatOf)),
    attachments: (planet.attachments ?? []).map((attachment) => attachment.card),
  };
}

function scenePlanet(base: PlanetDefinition, back: TileBack, at: PlanetSituation): ScenePlanet {
  const { planet } = at;
  const definition = planet === undefined ? base : withAttachments(base, planet);
  return {
    id: definition.id,
    name: nameOf(definition.id, at.language),
    definition,
    look: lookOf(definition, back),
    ...planetCondition(planet, at.seatOf),
    legendary: legendaryOf(definition, at.usedLegendaries ?? []),
  };
}

const tileFields = (tile: SystemTile) => ({
  systemId: tile.id,
  back: tile.back,
  wormholes: tile.wormholes,
  ...(tile.anomaly === undefined ? {} : { anomaly: tile.anomaly }),
});

const EMPTY = {
  ships: [],
  tokens: [],
  highlight: 'none',
  control: null,
  frontier: false,
  cache: 0,
} as const;

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
    scenePlanet(planet, tile.back, { language, seatOf: NO_SEAT }),
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

/** Ein einziger Besitzer von Schiffen und Planeten färbt den Rand des Systems. */
function controlOf(ships: readonly UnitCount[], planets: readonly ScenePlanet[]): number | null {
  const seats = new Set([
    ...ships.map((ship) => ship.seat),
    ...planets.flatMap((planet) => planet.controllerSeat ?? []),
  ]);
  return seats.size === 1 ? ([...seats][0] ?? null) : null;
}

/** PoK: Grenzmarker und Handelswaren-Depot im System. */
const explorationFields = (game: GameState, system: SystemState) => ({
  frontier: game.exploration.frontierTokens.includes(system.id),
  cache: game.exploration.caches[system.id] ?? 0,
});

/** Planeten eines Systems mit ihrem Stand in der Partie. */
function gamePlanets(lookup: GameLookup, tile: SystemTile): readonly ScenePlanet[] {
  const { game, language, seatOf } = lookup;
  const usedLegendaries = game.exploration.exhaustedLegendaries;
  return tile.planets.map((definition) =>
    scenePlanet(definition, tile.back, {
      language,
      seatOf,
      planet: game.planets[definition.id],
      usedLegendaries,
    }),
  );
}

function gameHex(lookup: GameLookup, system: SystemState, tile: SystemTile): SceneHex {
  const { game, seatOf } = lookup;
  const planets = gamePlanets(lookup, tile);
  const ships = countUnits(system.spaceUnits, unitSeat(seatOf));
  return {
    ...tileFields(tile),
    key: hexKey(system.position),
    position: system.position,
    kind: 'system',
    seat: homeSeat(lookup, system),
    planets,
    ships,
    tokens: system.commandTokens.flatMap((player) => seatOf(player) ?? []),
    highlight: lookup.highlights.get(system.id) ?? 'none',
    control: controlOf(ships, planets),
    ...explorationFields(game, system),
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
