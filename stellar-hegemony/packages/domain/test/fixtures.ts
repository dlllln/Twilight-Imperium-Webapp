import {
  type ActionCardDefinition,
  type AgendaDefinition,
  type AgendaEffect,
  agendaId,
  type Election,
  type LawEffect,
  type Recipients,
  actionCardId,
  type ContentPort,
  type ExplorationCardDefinition,
  explorationCardId,
  type RelicDefinition,
  relicId,
  factionId,
  type FactionDefinition,
  type GalaxyTemplate,
  hexRing,
  ORIGIN,
  StaticTileCatalog,
  type SystemTile,
  type GameConfig,
  type ObjectiveCondition,
  type ObjectiveDefinition,
  objectiveId,
  planetId,
  playerId,
  type PlanetState,
  type RandomPort,
  type RuleNumbers,
  StaticUnitCatalog,
  systemId,
  technologyId,
  type StrategyCardDefinition,
  strategyCardId,
  type SystemState,
  type TechnologyDefinition,
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
  statusPhaseActionCards: 1,
  nebulaMoveValue: 1,
  gravityRiftMoveBonus: 1,
  gravityRiftDestroyMaxRoll: 3,
  maxProductionStructuresPerPlanet: 1,
  maxCannonStructuresPerPlanet: 2,
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
  mech: unitTypeId('mech'),
  dock: unitTypeId('dock'),
  battery: unitTypeId('battery'),
  escort: unitTypeId('escort'),
  longBattery: unitTypeId('longBattery'),
  breaker: unitTypeId('breaker'),
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
    id: T.mech,
    category: 'groundForce',
    isFighter: false,
    cost: { resources: 2, unitsPerCost: 1 },
    combat: { hitOn: 6, dice: 1 },
    capabilities: [{ kind: 'sustainDamage' }],
    componentLimit: 4,
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
  {
    id: T.breaker,
    category: 'ship',
    isFighter: false,
    cost: { resources: 12, unitsPerCost: 1 },
    combat: { hitOn: 3, dice: 3 },
    move: 2,
    capacity: 6,
    capabilities: [
      { kind: 'sustainDamage' },
      { kind: 'bombardment', profile: { hitOn: 3, dice: 3 } },
      { kind: 'ignoresPlanetaryShield' },
    ],
    componentLimit: 2,
    requiresTechnology: technologyId('breaker-plans'),
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
  tile('b1', 'blue', {
    planets: [{ id: planetId('alpha-1'), resources: 2, influence: 1, trait: 'industrial' }],
  }),
  tile('b2', 'blue', {
    planets: [
      { id: planetId('beta-1'), resources: 1, influence: 2, trait: 'cultural' },
      {
        id: planetId('beta-2'),
        resources: 0,
        influence: 1,
        legendary: { kind: 'placeUnits', unit: unitTypeId('infantry'), count: 2 },
      },
    ],
  }),
  tile('b3', 'blue', {
    planets: [
      { id: planetId('gamma-1'), resources: 3, influence: 0, technologySpecialty: 'propulsion' },
    ],
  }),
  tile('b4', 'blue', {
    wormholes: ['alpha'],
    planets: [{ id: planetId('delta-1'), resources: 1, influence: 1, trait: 'hazardous' }],
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
  startingTechnologies: color === 'green' ? [technologyId('drive-a')] : [],
  abilities: [],
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
  strategyCard(4, 'construction', { structures: 2 }),
  strategyCard(5, 'trade', { tradeGoods: 3 }),
  strategyCard(6, 'warfare'),
  strategyCard(7, 'technology', { extraResearchCost: 6, secondaryResearchCost: 4 }),
  strategyCard(8, 'imperial', { throneVictoryPoints: 1 }),
];

export const CARD = (initiative: number) => strategyCardId(`card-${String(initiative)}`);

const research = (
  id: string,
  color: TechnologyDefinition['color'],
  prerequisites: TechnologyDefinition['prerequisites'],
  extra: Partial<TechnologyDefinition> = {},
): TechnologyDefinition => ({
  id: technologyId(id),
  color,
  prerequisites,
  modifiers: [],
  ...extra,
});

/** Kleiner Technologiebaum: Antrieb in drei Stufen, Waffen, Zielerfassung, eine Aufwertung. */
export const TECHNOLOGIES: readonly TechnologyDefinition[] = [
  research('drive-a', 'propulsion', [], {
    modifiers: [{ target: { types: [T.cruiser] }, change: { move: 1 } }],
  }),
  research('drive-b', 'propulsion', ['propulsion'], { rules: { fleetLimit: 2 } }),
  research('drive-c', 'propulsion', ['propulsion', 'propulsion'], {
    modifiers: [{ target: { category: 'ship', fighters: false }, change: { move: 1 } }],
  }),
  research('gunnery', 'warfare', [], {
    modifiers: [
      { target: { types: [T.cruiser] }, change: { hitOn: -1 } },
      { target: { types: [T.battleship] }, change: { dice: 1 } },
    ],
  }),
  research('targeting', 'cybernetic', [], {
    modifiers: [
      {
        target: { types: [T.escort] },
        change: { capability: { kind: 'antiFighterBarrage', hitOn: -1, dice: 1 } },
      },
      {
        target: { category: 'structure' },
        change: { capability: { kind: 'spaceCannon', range: 1 } },
      },
      {
        target: { types: [T.dock] },
        change: { capability: { kind: 'fighterHangar', fighters: 1 } },
      },
      { target: { types: [T.dock] }, change: { capability: { kind: 'production', bonus: 1 } } },
    ],
  }),
  research('armour', 'biotic', [], {
    modifiers: [{ target: { types: [T.infantry] }, change: { add: [{ kind: 'sustainDamage' }] } }],
  }),
  research('heavy-carrier', null, ['propulsion', 'propulsion'], {
    upgrades: T.carrier,
    modifiers: [{ target: { types: [T.carrier] }, change: { set: { move: 2, capacity: 6 } } }],
  }),
  research('breaker-plans', 'warfare', ['warfare']),
  research('scanner', 'propulsion', [], { rules: { exploresFrontier: true } }),
];

const objective = (
  id: string,
  category: ObjectiveDefinition['category'],
  stage: ObjectiveDefinition['stage'],
  condition: ObjectiveCondition,
  timing: ObjectiveDefinition['timing'] = 'status',
): ObjectiveDefinition => ({
  id: objectiveId(id),
  category,
  stage,
  points: stage === 2 ? 2 : 1,
  timing,
  condition,
});

/** Zwei Aufträge der Stufe I, einer der Stufe II, acht geheime. */
export const OBJECTIVES: readonly ObjectiveDefinition[] = [
  objective('two-worlds', 'public', 1, { kind: 'planets', count: 2 }),
  objective('pay-three', 'public', 1, { kind: 'spend', currency: 'resources', amount: 3 }),
  objective('hold-center', 'public', 2, { kind: 'systemsWithShips', where: 'center', count: 1 }),
  objective('goods-3', 'secret', null, { kind: 'tradeGoods', count: 3 }),
  objective('fleet-4', 'secret', null, { kind: 'fleetPool', count: 4 }),
  objective(
    'won-1',
    'secret',
    null,
    { kind: 'roundStat', stat: 'spaceCombatsWon', count: 1 },
    'action',
  ),
  objective('tokens-1', 'secret', null, { kind: 'systemsWithTokens', count: 1 }),
  objective(
    'gained-1',
    'secret',
    null,
    { kind: 'roundStat', stat: 'planetsGained', count: 1 },
    'action',
  ),
  objective('fighters-2', 'secret', null, { kind: 'units', type: T.fighter, count: 2 }),
  objective('upgrade-1', 'secret', null, { kind: 'unitUpgrades', count: 1 }),
  objective('throne', 'secret', null, { kind: 'centerPlanet' }),
];

const actionCard = (
  id: string,
  timing: ActionCardDefinition['timing'],
  effect: ActionCardDefinition['effect'],
): ActionCardDefinition => ({ id: actionCardId(id), copies: 2, timing, effect });

/** Je Wirkungsart eine Karte in zwei Exemplaren. */
export const ACTION_CARDS: readonly ActionCardDefinition[] = [
  actionCard('goods', 'action', { kind: 'gainTradeGoods', amount: 2 }),
  actionCard('convoy', 'action', { kind: 'replenishCommodities' }),
  actionCard('ready', 'action', { kind: 'readyPlanets', count: 2 }),
  actionCard('reserve', 'action', { kind: 'gainCommandTokens', amount: 1 }),
  actionCard('recall', 'action', { kind: 'recallToken' }),
  actionCard('recruit', 'action', {
    kind: 'placeUnits',
    unit: T.infantry,
    count: 2,
    where: 'homePlanet',
  }),
  actionCard('intel', 'action', { kind: 'drawActionCards', count: 2 }),
  actionCard('unrest', 'action', { kind: 'exhaustForeignPlanet' }),
  actionCard('marque', 'action', { kind: 'stealTradeGoods', amount: 2 }),
  actionCard('raid', 'action', { kind: 'destroyGroundForce', count: 1 }),
  actionCard('dock', 'action', { kind: 'repairUnits' }),
  actionCard('mission', 'action', { kind: 'tradeGoodsPerNeighbor', amount: 1 }),
  actionCard('counter', 'cancel', { kind: 'cancelCard' }),
  actionCard('mobilize', 'afterActivation', {
    kind: 'placeUnits',
    unit: T.infantry,
    count: 1,
    where: 'activatedPlanet',
  }),
  actionCard('drill', 'combatRound', { kind: 'combatBonus', amount: 1 }),
  actionCard('evade', 'afterHits', { kind: 'cancelHits', amount: 1 }),
  actionCard('entrench', 'invasion', { kind: 'groundBonus', amount: 1, role: 'defender' }),
  actionCard('landing', 'invasion', { kind: 'groundBonus', amount: 1, role: 'attacker' }),
  actionCard('rider', 'secondary', { kind: 'freeSecondary' }),
];

export const AC = (id: string) => actionCardId(id);

const FOR_AGAINST: Election = { kind: 'forAgainst' };
const ELECT_PLAYER: Election = { kind: 'player' };
type Step = readonly [Recipients, AgendaEffect];
const steps = (list: readonly Step[]) =>
  list.map(([recipients, effect]) => ({ recipients, effect }));

const testLaw = (
  id: string,
  election: Election,
  effect: LawEffect,
  rejected: readonly Step[] = [],
): AgendaDefinition => ({
  id: agendaId(id),
  kind: 'law',
  election,
  passed: { steps: [], law: effect },
  rejected: steps(rejected),
});

const testDirective = (
  id: string,
  election: Election,
  passed: readonly Step[],
  rejected: readonly Step[] = [],
): AgendaDefinition => ({
  id: agendaId(id),
  kind: 'directive',
  election,
  passed: { steps: steps(passed) },
  rejected: steps(rejected),
});

/** Eine Agenda je Wirkungsart und je Gesetzesart. */
export const AGENDAS: readonly AgendaDefinition[] = [
  testLaw('charter', FOR_AGAINST, { kind: 'commodityLimitAll', delta: 1 }, [
    ['supporters', { kind: 'gainTradeGoods', amount: 1 }],
  ]),
  testLaw('quota', FOR_AGAINST, { kind: 'ruleChange', rule: 'actionCardHandLimit', delta: -2 }, [
    ['all', { kind: 'drawActionCards', count: 1 }],
  ]),
  testLaw('seat', ELECT_PLAYER, { kind: 'ownerVotes', amount: 2 }),
  testLaw('chancellor', ELECT_PLAYER, { kind: 'ownerVictoryPoints', amount: 1 }),
  testLaw('guild', ELECT_PLAYER, { kind: 'ownerCommodityLimit', amount: 2 }),
  testDirective(
    'stimulus',
    FOR_AGAINST,
    [['all', { kind: 'gainTradeGoods', amount: 2 }]],
    [['all', { kind: 'replenishCommodities' }]],
  ),
  testDirective(
    'audit',
    FOR_AGAINST,
    [['all', { kind: 'loseTradeGoods', amount: 2 }]],
    [['opponents', { kind: 'gainTradeGoods', amount: 1 }]],
  ),
  testDirective('medal', ELECT_PLAYER, [['elected', { kind: 'gainVictoryPoints', amount: 1 }]]),
  testDirective('leak', ELECT_PLAYER, [['elected', { kind: 'drawActionCards', count: 2 }]]),
  testDirective('mandate', ELECT_PLAYER, [['elected', { kind: 'drawSecretObjective' }]]),
  testDirective(
    'mobilize',
    FOR_AGAINST,
    [['all', { kind: 'gainCommandTokens', pool: 'tactic', amount: 1 }]],
    [['opponents', { kind: 'loseCommandTokens', pool: 'fleet', amount: 1 }]],
  ),
  testDirective('blackout', FOR_AGAINST, [
    ['all', { kind: 'exhaustPlanets', trait: 'industrial' }],
  ]),
  testDirective('survey', { kind: 'planet', filter: { kind: 'nonHome' } }, [
    ['elected', { kind: 'placeUnits', unit: T.infantry, count: 2, where: 'electedPlanet' }],
  ]),
  testDirective('cleanup', { kind: 'planet', filter: { kind: 'any' } }, [
    ['speaker', { kind: 'destroyStructures' }],
  ]),
  testDirective('culture', { kind: 'planet', filter: { kind: 'trait', trait: 'cultural' } }, [
    ['elected', { kind: 'gainTradeGoods', amount: 1 }],
  ]),
  testDirective(
    'amnesty',
    FOR_AGAINST,
    [['all', { kind: 'drawActionCards', count: 1 }]],
    [['all', { kind: 'discardActionCards', count: 1 }]],
  ),
  testDirective('reform', FOR_AGAINST, [['speaker', { kind: 'repealLaws' }]]),
  testDirective('conscript', ELECT_PLAYER, [
    ['elected', { kind: 'placeUnits', unit: T.infantry, count: 3, where: 'homeSystem' }],
  ]),
  testDirective('review', FOR_AGAINST, [['all', { kind: 'repairUnits' }]]),
  testDirective('tribunal', ELECT_PLAYER, [
    ['elected', { kind: 'discardActionCards', count: null }],
  ]),
];

export const AG = (id: string) => agendaId(id);

const explorationCard = (
  id: string,
  deck: ExplorationCardDefinition['deck'],
  effect: ExplorationCardDefinition['effect'],
): ExplorationCardDefinition => ({ id: explorationCardId(id), deck, copies: 1, effect });

/** Je Stapel eine Anlage oder Belohnung und ein Fragment; die Grenze mit Depot und Anlage. */
export const EXPLORATION_CARDS: readonly ExplorationCardDefinition[] = [
  explorationCard('ore', 'industrial', { kind: 'attachment', resources: 2, influence: 0 }),
  explorationCard('shard-i', 'industrial', { kind: 'relicFragment' }),
  explorationCard('archive', 'cultural', {
    kind: 'attachment',
    resources: 0,
    influence: 2,
    specialty: 'biotic',
  }),
  explorationCard('caravan', 'cultural', { kind: 'gainTradeGoods', amount: 2 }),
  explorationCard('militia', 'hazardous', { kind: 'placeUnits', unit: T.infantry, count: 2 }),
  explorationCard('shard-h', 'hazardous', { kind: 'relicFragment' }),
  explorationCard('depot', 'frontier', { kind: 'tradeGoodsCache', amount: 3 }),
  explorationCard('shard-f', 'frontier', { kind: 'relicFragment' }),
  explorationCard('drift', 'frontier', { kind: 'attachment', resources: 1, influence: 1 }),
  explorationCard('envoys', 'frontier', { kind: 'gainCommodities', amount: 2 }),
];

export const XC = (id: string) => explorationCardId(id);

const relic = (id: string, effect: RelicDefinition['effect']): RelicDefinition => ({
  id: relicId(id),
  effect,
});

/** Je Reliktart mindestens ein Relikt. */
export const RELICS: readonly RelicDefinition[] = [
  relic('crown', { kind: 'onGain', reward: { kind: 'gainVictoryPoints', amount: 1 } }),
  relic('core', { kind: 'onGain', reward: { kind: 'gainCommandTokens', amount: 2 } }),
  relic('banner', {
    kind: 'passive',
    modifiers: [{ target: { types: [T.infantry] }, change: { hitOn: -1 } }],
    fleetLimit: 1,
  }),
  relic('prism', {
    kind: 'action',
    reward: { kind: 'gainTradeGoods', amount: 2 },
    usage: 'exhaust',
  }),
  relic('capsule', { kind: 'action', reward: { kind: 'readyPlanets' }, usage: 'purge' }),
];

export const RL = (id: string) => relicId(id);

export const content: ContentPort = {
  units: catalog,
  tiles: new StaticTileCatalog(TILES),
  strategyCards: STRATEGY_CARDS,
  factions: FACTIONS,
  technologies: TECHNOLOGIES,
  objectives: OBJECTIVES,
  actionCards: ACTION_CARDS,
  agendas: AGENDAS,
  explorationCards: EXPLORATION_CARDS,
  relics: RELICS,
  galaxyTemplate: (playerCount) => (playerCount === TEMPLATE.playerCount ? TEMPLATE : undefined),
};

export const contextWith = (random: RandomPort = new ScriptedRandom([0])) => ({
  random,
  now: 0,
  content,
});
