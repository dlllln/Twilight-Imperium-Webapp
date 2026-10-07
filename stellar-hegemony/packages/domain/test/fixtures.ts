import {
  type GameConfig,
  planetId,
  playerId,
  type PlanetState,
  type RandomPort,
  type RuleNumbers,
  StaticUnitCatalog,
  systemId,
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
];

export const catalog = new StaticUnitCatalog(definitions);

let sequence = 0;
export const unit = (type: (typeof T)[keyof typeof T], owner = RED, damaged = false): Unit => ({
  id: unitId(`u${++sequence}`),
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
