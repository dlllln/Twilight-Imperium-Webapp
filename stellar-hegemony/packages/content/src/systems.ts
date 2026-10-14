import {
  planetId,
  systemId,
  type PlanetDefinition,
  type PlanetTrait,
  type RewardEffect,
  type SystemTile,
  type TechnologyColor,
} from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { UNIT_TYPES } from './units.ts';

/*
 * Eigene Systeme und Planeten (Namen und Werte frei erfunden). Verteilung und
 * Größenordnung orientieren sich am Spielgefühl, nicht an einer Vorlage.
 */
export interface PlanetSeed {
  readonly name: string;
  readonly resources: number;
  readonly influence: number;
  readonly trait?: PlanetTrait;
  readonly specialty?: TechnologyColor;
}

export const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ ä: 'ae', ö: 'oe', ü: 'ue' })[char] ?? char)
    .replace(/[^a-z0-9]+/g, '-');

const PLANET_NAMES: Record<string, LocalizedText> = {};

function planet(seed: PlanetSeed): PlanetDefinition {
  const id = planetId(slug(seed.name));
  PLANET_NAMES[id] = { de: seed.name, en: seed.name };
  return {
    id,
    resources: seed.resources,
    influence: seed.influence,
    ...(seed.trait === undefined ? {} : { trait: seed.trait }),
    ...(seed.specialty === undefined ? {} : { technologySpecialty: seed.specialty }),
  };
}

export const p = (
  name: string,
  resources: number,
  influence: number,
  trait?: PlanetTrait,
  specialty?: TechnologyColor,
): PlanetSeed => ({
  name,
  resources,
  influence,
  ...(trait === undefined ? {} : { trait }),
  ...(specialty === undefined ? {} : { specialty }),
});

const blue = (id: string, ...planets: PlanetSeed[]): SystemTile => ({
  id: systemId(id),
  back: 'blue',
  planets: planets.map(planet),
  wormholes: [],
});

export const CENTER_TILE: SystemTile = {
  id: systemId('thronwelt'),
  back: 'center',
  planets: [planet(p('Thronwelt Aurum', 1, 6))],
  wormholes: [],
};

export const BLUE_TILES: readonly SystemTile[] = [
  blue('b01', p('Orrin', 2, 1, 'industrial')),
  blue('b02', p('Calyx', 1, 2, 'cultural')),
  blue('b03', p('Veyra', 3, 0, 'hazardous', 'warfare')),
  blue('b04', p('Tamsin', 0, 3, 'cultural')),
  blue('b05', p('Brunn', 2, 2, 'industrial', 'cybernetic')),
  blue('b06', p('Sol Dera', 1, 3, 'cultural')),
  blue('b07', p('Kharn', 4, 1, 'hazardous')),
  blue('b08', p('Lysse', 2, 0, 'industrial', 'propulsion')),
  blue('b09', p('Mirabel', 1, 1, 'cultural', 'biotic')),
  blue('b10', p('Quorra', 3, 1, 'industrial')),
  blue('b11', p('Nebulon', 0, 2, 'hazardous', 'propulsion')),
  blue('b12', p('Ystra', 2, 3, 'cultural')),
  blue('b13', p('Fendel', 1, 0, 'hazardous'), p('Fendel Minor', 2, 1, 'industrial')),
  blue('b14', p('Adara', 1, 2, 'cultural'), p('Brekk', 2, 0, 'hazardous', 'biotic')),
  blue('b15', p('Sorrow', 3, 2, 'hazardous'), p('Pell', 0, 1, 'cultural')),
  blue('b16', p('Zenith', 2, 1, 'industrial', 'warfare'), p('Halcyon', 1, 1, 'cultural')),
  blue('b17', p('Ombra', 1, 1, 'industrial'), p('Lantis', 1, 2, 'cultural', 'cybernetic')),
  blue('b18', p('Ruskar', 3, 0, 'industrial'), p('Myrr', 0, 3, 'cultural')),
  blue('b19', p('Thessaly', 2, 2, 'hazardous', 'propulsion')),
  blue('b20', p('Corvin', 1, 3, 'industrial')),
  blue('b21', p('Ilmar', 2, 1, 'hazardous', 'biotic'), p('Ost-Ilmar', 1, 1, 'industrial')),
  blue('b22', p('Gardo', 4, 0, 'industrial')),
  blue('b23', p('Pallas', 0, 4, 'cultural')),
  blue('b24', p('Wyrm', 2, 2, 'hazardous', 'cybernetic')),
  { ...blue('b25', p('Torus', 1, 2, 'cultural')), wormholes: ['alpha'] },
  { ...blue('b26', p('Spirale', 2, 1, 'hazardous')), wormholes: ['beta'] },
];

const red = (id: string, extra: Partial<SystemTile>): SystemTile => ({
  id: systemId(id),
  back: 'red',
  planets: [],
  wormholes: [],
  ...extra,
});

export const RED_TILES: readonly SystemTile[] = [
  red('r01', { anomaly: 'asteroidField' }),
  red('r02', { anomaly: 'asteroidField' }),
  red('r03', { anomaly: 'nebula' }),
  red('r04', { anomaly: 'nebula' }),
  red('r05', { anomaly: 'supernova' }),
  red('r06', { anomaly: 'gravityRift' }),
  red('r07', { anomaly: 'gravityRift' }),
  red('r08', {}),
  red('r09', {}),
  red('r10', {}),
  red('r11', { wormholes: ['alpha'] }),
  red('r12', { wormholes: ['beta'] }),
];

/** Heimatsystem einer Fraktion (Rückseite „home“, liegt nur auf Heimat-Plätzen). */
export const homeTile = (id: string, ...planets: PlanetSeed[]): SystemTile => ({
  id: systemId(id),
  back: 'home',
  planets: planets.map(planet),
  wormholes: [],
});

/** Blaue Tafel mit einem legendären Planeten (Erweiterung Schritt 2). */
const legendary = (id: string, seed: PlanetSeed, ability: RewardEffect): SystemTile => {
  const tile = blue(id, seed);
  return { ...tile, planets: tile.planets.map((planet) => ({ ...planet, legendary: ability })) };
};

/**
 * PoK Legendäre Planeten: zwei eigene Tafeln. Sie liegen wie blaue Tafeln im Vorrat des
 * Galaxie-Generators und können so in zufälligen Galaxien auftauchen.
 */
export const LEGENDARY_TILES: readonly SystemTile[] = [
  legendary('l01', p('Elysar', 2, 3, 'cultural'), {
    kind: 'placeUnits',
    unit: UNIT_TYPES.infantry,
    count: 2,
  }),
  legendary('l02', p('Morgantis', 3, 1, 'hazardous'), {
    kind: 'gainTradeGoods',
    amount: 2,
  }),
];

export interface LegendaryText {
  readonly name: LocalizedText;
  readonly effect: LocalizedText;
}

/** Name und Text der legendären Fähigkeit je Planet. */
export const LEGENDARY_TEXTS: Readonly<Record<string, LegendaryText>> = {
  elysar: {
    name: { de: 'Heimkehr der Siedler', en: "Settlers' Homecoming" },
    effect: {
      de: 'Aktion, einmal je Runde: Setze 2 Infanterie aus deiner Verstärkung auf Elysar.',
      en: 'Action, once per round: Place 2 infantry from your reinforcements on Elysar.',
    },
  },
  morgantis: {
    name: { de: 'Tiefenschmelze', en: 'Deep Smelters' },
    effect: {
      de: 'Aktion, einmal je Runde: Erhalte 2 Handelswaren.',
      en: 'Action, once per round: Gain 2 trade goods.',
    },
  },
};

export const legendaryText = (planet: string): LegendaryText | undefined => LEGENDARY_TEXTS[planet];

export const GALAXY_TILES: readonly SystemTile[] = [
  CENTER_TILE,
  ...BLUE_TILES,
  ...LEGENDARY_TILES,
  ...RED_TILES,
];

export const planetName = (id: string): LocalizedText | undefined => PLANET_NAMES[id];
