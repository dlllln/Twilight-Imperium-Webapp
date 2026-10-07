import {
  factionId,
  type FactionDefinition,
  planetId,
  type SystemTile,
  technologyId,
  type UnitStack,
  type UnitTypeId,
} from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { GALAXY_TILES, homeTile, p, slug } from './systems.ts';
import { UNIT_TYPES } from './units.ts';

/*
 * Eigene Fraktionen mit eigenen Namen und Heimatwelten. Sie unterscheiden sich
 * bisher durch Heimatsystem, Startflotte und Massenprodukte; Fähigkeiten folgen
 * in Iteration 11. Jede Startflotte hat höchstens 3 Nicht-Jäger-Schiffe,
 * damit sie zum Start-Flottenpool passt.
 */
const U = UNIT_TYPES;

const units = (...entries: readonly (readonly [UnitTypeId, number])[]): readonly UnitStack[] =>
  entries.map(([type, count]) => ({ type, count }));

const on = (name: string, ...entries: readonly (readonly [UnitTypeId, number])[]) => ({
  planet: planetId(slug(name)),
  units: units(...entries),
});

interface FactionSeed {
  readonly id: string;
  readonly name: LocalizedText;
  readonly home: SystemTile;
  readonly space: readonly UnitStack[];
  readonly planets: FactionDefinition['startingForces']['planets'];
  readonly commodityLimit: number;
  readonly technologies: readonly string[];
}

const SEEDS: readonly FactionSeed[] = [
  {
    id: 'aurel',
    name: { de: 'Liga von Aurel', en: 'League of Aurel' },
    home: homeTile('home-aurel', p('Aurelis', 4, 2, 'industrial')),
    space: units([U.carrier, 2], [U.dreadnought, 1], [U.fighter, 3]),
    planets: [on('Aurelis', [U.infantry, 4], [U.orbitalDock, 1])],
    commodityLimit: 3,
    technologies: ['ion-drive', 'target-acquisition'],
  },
  {
    id: 'orun',
    name: { de: 'Orun-Kollektiv', en: 'Orun Collective' },
    home: homeTile('home-orun', p('Orun', 2, 3, 'cultural'), p('Orun Tief', 2, 1, 'hazardous')),
    space: units([U.carrier, 1], [U.cruiser, 2], [U.fighter, 2]),
    planets: [on('Orun', [U.infantry, 3], [U.orbitalDock, 1]), on('Orun Tief', [U.infantry, 1])],
    commodityLimit: 3,
    technologies: ['cell-regeneration'],
  },
  {
    id: 'sel',
    name: { de: 'Handelsbund von Sel', en: 'Sel Trade Compact' },
    home: homeTile('home-sel', p('Selis', 3, 1, 'industrial'), p('Kadrun', 1, 2, 'cultural')),
    space: units([U.carrier, 2], [U.destroyer, 1], [U.fighter, 2]),
    planets: [on('Selis', [U.infantry, 3], [U.orbitalDock, 1]), on('Kadrun', [U.infantry, 1])],
    commodityLimit: 4,
    technologies: ['target-acquisition'],
  },
  {
    id: 'karth',
    name: { de: 'Dominion Karth', en: 'Karth Dominion' },
    home: homeTile('home-karth', p('Karthos', 5, 1, 'hazardous')),
    space: units([U.carrier, 1], [U.dreadnought, 2], [U.fighter, 1]),
    planets: [on('Karthos', [U.infantry, 3], [U.orbitalDock, 1])],
    commodityLimit: 2,
    technologies: ['reactive-plating', 'cell-regeneration'],
  },
  {
    id: 'nesh',
    name: { de: 'Sternwacht Nesh', en: 'Nesh Starwatch' },
    home: homeTile('home-nesh', p('Neshara', 3, 2, 'cultural'), p('Vael', 0, 2, 'cultural')),
    space: units([U.carrier, 1], [U.cruiser, 1], [U.destroyer, 1], [U.fighter, 3]),
    planets: [
      on('Neshara', [U.infantry, 2], [U.orbitalDock, 1], [U.orbitalBattery, 1]),
      on('Vael', [U.infantry, 1]),
    ],
    commodityLimit: 3,
    technologies: ['ion-drive'],
  },
  {
    id: 'quel',
    name: { de: 'Schwarm von Quel', en: 'Quel Swarm' },
    home: homeTile('home-quel', p('Quellis', 2, 2, 'hazardous'), p('Kiro', 2, 1, 'industrial')),
    space: units([U.carrier, 2], [U.destroyer, 1], [U.fighter, 4]),
    planets: [on('Quellis', [U.infantry, 4], [U.orbitalDock, 1]), on('Kiro', [U.infantry, 1])],
    commodityLimit: 3,
    technologies: ['cell-regeneration', 'ion-drive'],
  },
];

export const FACTIONS: readonly FactionDefinition[] = SEEDS.map((seed) => ({
  id: factionId(seed.id),
  homeSystem: seed.home,
  startingForces: { space: seed.space, planets: seed.planets },
  commodityLimit: seed.commodityLimit,
  startingTechnologies: seed.technologies.map(technologyId),
}));

export const FACTION_NAMES: Readonly<Record<string, LocalizedText>> = Object.fromEntries(
  SEEDS.map((seed) => [seed.id, seed.name]),
);

/** Galaxie-Tafeln plus Heimatsysteme: alles, was auf dem Spielplan liegen kann. */
export const ALL_TILES: readonly SystemTile[] = [
  ...GALAXY_TILES,
  ...FACTIONS.map((faction) => faction.homeSystem),
];
