import { findPlayer, type GameState } from '../game/game-state.ts';
import type { PlanetTrait, TechnologyColor } from '../planet/planet-definition.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlayerId } from '../shared/ids.ts';
import { ownedTechnologies } from '../technology/technology-catalog.ts';
import { hasCapability, isShip, isStructure } from '../unit/unit-capabilities.ts';
import type { UnitDefinition } from '../unit/unit-definition.ts';
import type { Unit } from '../unit/unit.ts';
import {
  adjacentToCenter,
  centerSystems,
  controlsCenter,
  foreignHomes,
  homeSystemIdOf,
  ownPlanets,
  systemOfPlanet,
  unitsOnBoard,
} from './board-queries.ts';
import type { ObjectiveCondition, SystemFilter } from './objective-definition.ts';
import { NO_ROUND_STATS } from './objective-state.ts';

export interface ConditionInput {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly content: ContentPort;
}

type Of<K extends ObjectiveCondition['kind']> = Extract<ObjectiveCondition, { kind: K }>;
type Checker<K extends ObjectiveCondition['kind']> = (input: ConditionInput, c: Of<K>) => boolean;

const TRAITS: readonly PlanetTrait[] = ['cultural', 'hazardous', 'industrial'];
const COLORS: readonly TechnologyColor[] = ['biotic', 'propulsion', 'cybernetic', 'warfare'];

const definitionOf = ({ content }: ConditionInput, unit: Unit) =>
  content.units.find(unit.type, unit.owner) ?? null;

const ownUnits = (input: ConditionInput, test: (definition: UnitDefinition) => boolean) =>
  unitsOnBoard(input.state, input.player).filter((unit) => {
    const definition = definitionOf(input, unit);
    return definition !== null && test(definition);
  });

function planets({ state, player, content }: ConditionInput, c: Of<'planets'>): boolean {
  const home = homeSystemIdOf(state, player, content);
  const counted = ownPlanets(state, player, content).filter(
    ({ state: planet, definition }) =>
      (c.trait === undefined || definition.trait === c.trait) &&
      (c.exceptHome !== true || systemOfPlanet(state, planet.id)?.id !== home),
  );
  return counted.length >= c.count;
}

const planetsOfEachTrait: Checker<'planetsOfEachTrait'> = (input, c) =>
  TRAITS.every((trait) => planets(input, { kind: 'planets', count: c.count, trait }));

const specialtyPlanets: Checker<'specialtyPlanets'> = ({ state, player, content }, c) => {
  const colors = ownPlanets(state, player, content).flatMap(
    ({ definition }) => definition.technologySpecialty ?? [],
  );
  return (c.distinct === true ? new Set(colors).size : colors.length) >= c.count;
};

const colorCounts = ({ state, player, content }: ConditionInput) =>
  COLORS.map(
    (color) => ownedTechnologies(state, player, content).filter((t) => t.color === color).length,
  );

const technologiesInColors: Checker<'technologiesInColors'> = (input, c) =>
  colorCounts(input).filter((count) => count >= c.perColor).length >= c.colors;

const technologiesOfColor: Checker<'technologiesOfColor'> = (input, c) => {
  const counts = colorCounts(input);
  const count =
    c.color === undefined ? Math.max(...counts) : (counts[COLORS.indexOf(c.color)] ?? 0);
  return count >= c.count;
};

const unitUpgrades: Checker<'unitUpgrades'> = ({ state, player, content }, c) =>
  ownedTechnologies(state, player, content).filter((tech) => tech.upgrades !== undefined).length >=
  c.count;

const structuredPlanets: Checker<'structuredPlanets'> = (input, c) =>
  Object.values(input.state.planets).filter((planet) =>
    planet.units.some((unit) => {
      const definition = definitionOf(input, unit);
      return unit.owner === input.player && definition !== null && isStructure(definition);
    }),
  ).length >= c.count;

const structures: Checker<'structures'> = (input, c) =>
  ownUnits(input, (d) => isStructure(d) && hasCapability(d, c.capability)).length >= c.count;

const units: Checker<'units'> = (input, c) =>
  ownUnits(input, (definition) => definition.id === c.type).length >= c.count;

/** Systeme, die zum Filter passen; Zentrum und Heimatsysteme kommen aus dem Content. */
function systemFilter(input: ConditionInput, where: SystemFilter) {
  const { state, player, content } = input;
  const home = homeSystemIdOf(state, player, content);
  const center = centerSystems(state, content).map((system) => system.id);
  const foreign = foreignHomes(state, player, content);
  const filters: Record<SystemFilter, (id: string) => boolean> = {
    anyNonHome: (id) => id !== home,
    anomaly: (id) => state.systems[id]?.anomaly !== undefined,
    adjacentToCenter: (id) => {
      const system = state.systems[id];
      return system !== undefined && adjacentToCenter(state, system, content);
    },
    center: (id) => center.includes(id as never),
    foreignHome: (id) => foreign.includes(id as never),
  };
  return filters[where];
}

const shipCount = (input: ConditionInput, units: readonly Unit[], fighters: boolean) =>
  units.filter((unit) => {
    const definition = definitionOf(input, unit);
    return (
      unit.owner === input.player &&
      definition !== null &&
      isShip(definition) &&
      (fighters || !definition.isFighter)
    );
  }).length;

const systemsWithShips: Checker<'systemsWithShips'> = (input, c) => {
  const matches = systemFilter(input, c.where);
  return (
    Object.values(input.state.systems).filter(
      (system) => matches(system.id) && shipCount(input, system.spaceUnits, true) > 0,
    ).length >= c.count
  );
};

const shipsInOneSystem: Checker<'shipsInOneSystem'> = (input, c) =>
  Object.values(input.state.systems).some(
    (system) => shipCount(input, system.spaceUnits, false) >= c.count,
  );

const planetIn = (input: ConditionInput, systems: readonly string[]) =>
  ownPlanets(input.state, input.player, input.content).some(({ state: planet }) =>
    systems.includes(systemOfPlanet(input.state, planet.id)?.id ?? ''),
  );

const playerOf = ({ state, player }: ConditionInput) => findPlayer(state, player);

/** RR 12.4: je Art ein Prüfer (Strategy über eine Tabelle statt einer if-Kette). */
const CHECKERS: { readonly [K in ObjectiveCondition['kind']]: Checker<K> } = {
  planets,
  planetsOfEachTrait,
  specialtyPlanets,
  spend: () => true,
  tradeGoods: (input, c) => (playerOf(input)?.tradeGoods ?? 0) >= c.count,
  technologiesInColors,
  technologiesOfColor,
  unitUpgrades,
  structuredPlanets,
  structures,
  systemsWithShips,
  shipsInOneSystem,
  units,
  centerPlanet: ({ state, player, content }) => controlsCenter(state, player, content),
  foreignHomePlanet: (input) =>
    planetIn(input, foreignHomes(input.state, input.player, input.content)),
  fleetPool: (input, c) => (playerOf(input)?.commandPools.fleet ?? 0) >= c.count,
  systemsWithTokens: ({ state, player }, c) =>
    Object.values(state.systems).filter((system) => system.commandTokens.includes(player)).length >=
    c.count,
  roundStat: (input, c) => (playerOf(input)?.roundStats ?? NO_ROUND_STATS)[c.stat] >= c.count,
};

/**
 * Erfüllt der Spieler die Anforderung? Ausgaben (`spend`) prüft erst die Bezahlung beim
 * Werten; hier zählen sie als erfüllbar.
 */
export function meetsCondition(input: ConditionInput, condition: ObjectiveCondition): boolean {
  // TypeScript kann Art und Prüfer der Tabelle nicht korrelieren.
  const checker = CHECKERS[condition.kind] as (i: ConditionInput, c: ObjectiveCondition) => boolean;
  return checker(input, condition);
}
