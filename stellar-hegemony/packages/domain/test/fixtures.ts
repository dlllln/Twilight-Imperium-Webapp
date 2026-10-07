import {
  type ContentPort,
  factionId,
  type FactionDefinition,
  type GalaxyTemplate,
  hexRing,
  ORIGIN,
  StaticTileCatalog,
  type SystemTile,
  type GameConfig,
  planetId,
  playerId,
  type PlanetState,
  type RandomPort,
  type RuleNumbers,
  StaticUnitCatalog,
  systemId,
  type StrategyCardDefinition,
  strategyCardId,
  type SystemState,
  type Unit,
  unitId,
  unitTypeId,
  type UnitDefinition,
} from '../src/index.ts';

export const RED = playerId('red');
export const BLUE = playerId('blue');

export const RULES: RuleNumbers = {
  dieSides: 10,
  minPlayers: 3,
  maxPlayers: 6,
  victoryPointOptions: [10, 14],
  commandTokensPerPlayer: 16,
  startingCommandPools: { tactic: 3, fleet: 3, strategy: 2 },
  statusPhaseCommandTokens: 2,
  strategyCardCount: 8,
  strategyCardAllotment: { fewPlayersThreshold: 4, cardsWhenFewPlayers: 2, cardsOtherwise: 1 },
  publicObjectivesPerStage: 5,
  initiallyRevealedObjectives: 2,
  secretObjectivesDealt: 2,
  secretObjectivesKept: 1,
  maxSecretObjectives: 3,
  centerTokenInfluenceCost: 6,
  centerTokenVictoryPoints: 1,
  agendasPerPhase: 2,
  actionCardHandLimit: 7,
  nebulaMoveValue: 1,
  gravityRiftMoveBonus: 1,
  gravityRiftDestroyMaxRoll: 3,
};

export const config = (playerCount = 6, victoryPointsToWin = 10): GameConfig => ({
  playerCount,
  victoryPointsToWin,
  rules: RULES,
});

export const T = {
  carrier: unitTypeId('carrier'),
  cruiser: unitTypeId('cruiser'),
  battleship: unitTypeId('battleship'),
  fighter: unitTypeId('fighter'),
  infantry: unitTypeId('infantry'),
  dock: unitTypeId('dock'),
  battery: unitTypeId('battery'),
  escort: unitTypeId('escort'),
  longBattery: unitTypeId('longBattery'),
};

const definitions: readonly UnitDefinition[] = [
  {
    id: T.carrier,
    category: 'ship',
    isFighter: false,
    cost: { resources: 3, unitsPerCost: 1 },
    combat: { hitOn: 9, dice: 1 },
    move: 1,
    capacity: 4,
    capabilities: [],
    componentLimit: 4,
  },
  {
    id: T.cruiser,
    category: 'ship',
    isFighter: false,
    cost: { resources: 2, unitsPerCost: 1 },
    combat: { hitOn: 7, dice: 1 },
    move: 2,
    capabilities: [],
    componentLimit: 8,
  },
  {
    id: T.battleship,
    category: 'ship',
    isFighter: false,
    cost: { resources: 4, unitsPerCost: 1 },
    combat: { hitOn: 5, dice: 1 },
    move: 1,
    capacity: 1,
    capabilities: [
      { kind: 'sustainDamage' },
      { kind: 'bombardment', profile: { hitOn: 5, dice: 1 } },
    ],
    componentLimit: 5,
  },
  {
    id: T.fighter,
    category: 'ship',
    isFighter: true,
    cost: { resources: 1, unitsPerCost: 2 },
    combat: { hitOn: 9, dice: 1 },
    capabilities: [],
    componentLimit: 'unlimited',
  },
  {
    id: T.infantry,
    category: 'groundForce',
    isFighter: false,
    cost: { resources: 1, unitsPerCost: 2 },
    combat: { hitOn: 8, dice: 1 },
    capabilities: [],
    componentLimit: 'unlimited',
  },
  {
    id: T.dock,
    category: 'structure',
    isFighter: false,
    capabilities: [
      { kind: 'production', bonus: 2, addsPlanetResources: true },
      { kind: 'fighterHangar', fighters: 3 },
    ],
    componentLimit: 3,
  },
  {
    id: T.battery,
    category: 'structure',
    isFighter: false,
    capabilities: [
      { kind: 'spaceCannon', profile: { hitOn: 6, dice: 1 }, range: 0 },
      { kind: 'planetaryShield' },
    ],
    componentLimit: 6,
  },
  {
    id: T.escort,
    category: 'ship',
    isFighter: false,
    cost: { resources: 1, unitsPerCost: 1 },
    combat: { hitOn: 9, dice: 1 },
    move: 2,
    capabilities: [{ kind: 'antiFighterBarrage', profile: { hitOn: 9, dice: 2 } }],
    componentLimit: 8,
  },
  {
    id: T.longBattery,
    category: 'structure',
    isFighter: false,
    capabilities: [{ kind: 'spaceCannon', profile: { hitOn: 6, dice: 1 }, range: 1 }],
    componentLimit: 6,
  },
];

export const catalog = new StaticUnitCatalog(definitions);

let sequence = 0;
export const unit = (type: (typeof T)[keyof typeof T], owner = RED, damaged = false): Unit => ({
  id: unitId(`t${++sequence}`),
  type,
  owner,
  damaged,
});

export const units = (count: number, type: (typeof T)[keyof typeof T], owner = RED): Unit[] =>
  Array.from({ length: count }, () => unit(type, owner));

export const system = (spaceUnits: readonly Unit[], planetIds = [planetId('p1')]): SystemState => ({
  id: systemId('s1'),
  position: { q: 0, r: 0 },
  planetIds,
  wormholes: [],
  spaceUnits,
  commandTokens: [],
});

export const planetState = (overrides: Partial<PlanetState> = {}): PlanetState => ({
  id: planetId('p1'),
  controller: RED,
  exhausted: false,
  units: [],
  ...overrides,
});

/** Liefert vorgegebene Werte der Reihe nach (für deterministische Tests). */
export class ScriptedRandom implements RandomPort {
  private index = 0;
  constructor(private readonly values: readonly number[]) {}
  nextInt(minInclusive: number, maxInclusive: number): number {
    const value = this.values[this.index++ % this.values.length] ?? minInclusive;
    return Math.min(maxInclusive, Math.max(minInclusive, value));
  }
}

const tile = (
  id: string,
  back: SystemTile['back'],
  extra: Partial<SystemTile> = {},
): SystemTile => ({
  id: systemId(id),
  back,
  planets: [],
  wormholes: [],
  ...extra,
});

export const TILES: readonly SystemTile[] = [
  tile('center', 'center', { planets: [{ id: planetId('throne'), resources: 1, influence: 6 }] }),
  tile('b1', 'blue', { planets: [{ id: planetId('alpha-1'), resources: 2, influence: 1 }] }),
  tile('b2', 'blue', {
    planets: [
      { id: planetId('beta-1'), resources: 1, influence: 2 },
      { id: planetId('beta-2'), resources: 0, influence: 1 },
    ],
  }),
  tile('b3', 'blue', { planets: [{ id: planetId('gamma-1'), resources: 3, influence: 0 }] }),
  tile('b4', 'blue', {
    wormholes: ['alpha'],
    planets: [{ id: planetId('delta-1'), resources: 1, influence: 1 }],
  }),
  tile('r1', 'red', { anomaly: 'nebula' }),
  tile('r2', 'red', { anomaly: 'asteroidField' }),
  tile('r3', 'red', { wormholes: ['alpha'] }),
  tile('r4', 'red', { anomaly: 'gravityRift' }),
  tile('r5', 'red', { anomaly: 'supernova' }),
  tile('r6', 'red'),
  tile('r7', 'red'),
  tile('home-x', 'home'),
  ...['red', 'blue', 'green'].map((color) =>
    tile(`home-${color}`, 'home', {
      planets: [{ id: planetId(`${color}-prime`), resources: 3, influence: 2 }],
    }),
  ),
];

/** Testfraktionen „f-red“, „f-blue“, „f-green“: Träger, 2 Kreuzer, 2 Jäger; 3 Infanterie und Dock. */
export const FACTIONS: readonly FactionDefinition[] = ['red', 'blue', 'green'].map((color) => ({
  id: factionId(`f-${color}`),
  homeSystem: TILES.find((candidate) => candidate.id === `home-${color}`) as SystemTile,
  startingForces: {
    space: [
      { type: T.carrier, count: 1 },
      { type: T.cruiser, count: 2 },
      { type: T.fighter, count: 2 },
    ],
    planets: [
      {
        planet: planetId(`${color}-prime`),
        units: [
          { type: T.infantry, count: 3 },
          { type: T.dock, count: 1 },
        ],
      },
    ],
  },
  commodityLimit: 3,
}));

/** Kleine Galaxie: Zentrum, Ring 1 mit sechs Tafeln, drei Heimat-Plätze in Ring 2. */
export const TEMPLATE: GalaxyTemplate = {
  playerCount: 3,
  homeSlots: [0, 4, 8].map((index) => hexRing(ORIGIN, 2)[index] ?? ORIGIN),
  systemSlots: hexRing(ORIGIN, 1),
  blueTiles: 4,
  redTiles: 2,
};

const strategyCard = (
  initiative: number,
  mechanic: StrategyCardDefinition['mechanic'],
  parameters: Record<string, number> = {},
  secondaryCostsStrategyToken = true,
): StrategyCardDefinition => ({
  id: strategyCardId(`card-${String(initiative)}`),
  initiative,
  mechanic,
  secondaryCostsStrategyToken,
  parameters,
});

/** Karte 1 hat eine Wirkung, Karte 2 eine Sekundärwirkung mit Strategiemarker-Kosten. */
export const STRATEGY_CARDS: readonly StrategyCardDefinition[] = [
  strategyCard(1, 'commandTokens', { tokensGained: 3, influencePerToken: 3 }, false),
  strategyCard(2, 'commandTokens', { tokensGained: 2, influencePerToken: 2 }),
  strategyCard(3, 'diplomacy', { readyPlanets: 2 }),
  strategyCard(4, 'construction'),
  strategyCard(5, 'trade'),
  strategyCard(6, 'warfare'),
  strategyCard(7, 'technology'),
  strategyCard(8, 'imperial'),
];

export const CARD = (initiative: number) => strategyCardId(`card-${String(initiative)}`);

export const content: ContentPort = {
  units: catalog,
  tiles: new StaticTileCatalog(TILES),
  strategyCards: STRATEGY_CARDS,
  factions: FACTIONS,
  galaxyTemplate: (playerCount) => (playerCount === TEMPLATE.playerCount ? TEMPLATE : undefined),
};

export const contextWith = (random: RandomPort = new ScriptedRandom([0])) => ({
  random,
  now: 0,
  content,
});
