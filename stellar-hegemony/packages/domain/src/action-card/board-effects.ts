import { unitsOnBoard, homeSystemIdOf, systemOfPlanet } from '../objective/board-queries.ts';
import { shipsOf } from '../combat/combat-queries.ts';
import type { ContentPort } from '../ports/content-port.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import { groundForcesOn } from '../invasion/invasion-queries.ts';
import type { PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import { UnitNumbering } from '../unit/unit-numbering.ts';
import { type EffectRules } from './effect-rule.ts';

const ONE = 1;

const controlledIn = (state: GameState, system: SystemId | undefined, player: PlayerId) =>
  (state.systems[system ?? '']?.planetIds ?? []).filter(
    (planet) => state.planets[planet]?.controller === player,
  );

/** Planeten für neue Bodentruppen: im Heimatsystem oder im gerade aktivierten System. */
function placementPlanets(
  state: GameState,
  player: PlayerId,
  where: 'homePlanet' | 'activatedPlanet',
  content: ContentPort,
): readonly PlanetId[] {
  const system =
    where === 'homePlanet'
      ? homeSystemIdOf(state, player, content)
      : state.actionPhase?.tactical?.system;
  return controlledIn(state, system, player);
}

/** Bereite Planeten anderer Spieler außerhalb ihrer Heimatsysteme. */
const foreignPlanets = (state: GameState, player: PlayerId, content: ContentPort) =>
  Object.values(state.planets)
    .filter((planet) => planet.controller !== null && planet.controller !== player)
    .filter((planet) => !planet.exhausted)
    .filter(
      (planet) =>
        systemOfPlanet(state, planet.id)?.id !==
        homeSystemIdOf(state, planet.controller as PlayerId, content),
    )
    .map((planet) => planet.id);

/** Planeten mit fremden Bodentruppen in Systemen mit eigenen Schiffen. */
const raidablePlanets = (state: GameState, player: PlayerId, content: ContentPort) =>
  Object.values(state.systems)
    .filter((system) => shipsOf(state, system.id, player, content.units).length > 0)
    .flatMap((system) => system.planetIds)
    .filter(
      (planet) =>
        groundForcesOn(state, planet, content.units, (owner) => owner !== player).length > 0,
    );

/** Ein Event für den Planeten, sofern er in einem System liegt. */
const withSystem = <E>(state: GameState, planet: PlanetId, build: (system: SystemId) => E) => {
  const system = systemOfPlanet(state, planet);
  return system === undefined ? [] : [build(system.id)];
};

const exhaustedOwn = (state: GameState, player: PlayerId) =>
  Object.values(state.planets)
    .filter((planet) => planet.controller === player && planet.exhausted)
    .map((planet) => planet.id);

/** Wirkungen auf Planeten, Einheiten und Kommandomarker auf dem Spielplan. */
export const BOARD_EFFECTS = {
  readyPlanets: {
    targets: ({ state, player, effect }) => ({
      planets: { options: exhaustedOwn(state, player), max: effect.count },
    }),
    resolve: ({ player, target }) => [{ type: 'PlanetsReadied', player, planets: target.planets }],
  },
  recallToken: {
    targets: ({ state, player }) => ({
      systems: Object.values(state.systems)
        .filter((system) => system.commandTokens.includes(player))
        .map((system) => system.id),
    }),
    resolve: ({ state, player, target }) => {
      const pools = findPlayer(state, player)?.commandPools ?? NO_POOLS;
      return target.systems.flatMap((system) => [
        { type: 'CommandTokenReturned', player, system } as const,
        {
          type: 'CommandTokensRedistributed',
          player,
          pools: { ...pools, tactic: pools.tactic + ONE },
        } as const,
      ]);
    },
  },
  placeUnits: {
    targets: ({ state, player, effect, content }) => ({
      planets: { options: placementPlanets(state, player, effect.where, content), max: ONE },
    }),
    usable: ({ state, player, effect }) =>
      effect.where === 'homePlanet' || state.actionPhase?.active !== player,
    resolve: ({ state, player, effect, target }) =>
      target.planets.flatMap((planet) =>
        withSystem(state, planet, (system) => ({
          type: 'UnitsProduced',
          player,
          system,
          space: [],
          planet,
          ground: new UnitNumbering(state.nextUnitNumber).create(player, [
            { type: effect.unit, count: effect.count },
          ]),
        })),
      ),
  },
  exhaustForeignPlanet: {
    targets: ({ state, player, content }) => ({
      planets: { options: foreignPlanets(state, player, content), max: ONE },
    }),
    resolve: ({ state, target }) =>
      target.planets.flatMap((planet) => {
        const owner = state.planets[planet]?.controller;
        return owner == null
          ? []
          : [{ type: 'PlanetsExhausted', player: owner, planets: [planet] }];
      }),
  },
  destroyGroundForce: {
    targets: ({ state, player, content }) => ({
      planets: { options: raidablePlanets(state, player, content), max: ONE },
    }),
    resolve: ({ state, player, effect, target, content }) =>
      target.planets.flatMap((planet) =>
        withSystem(state, planet, (system) => ({
          type: 'UnitsDestroyed',
          system,
          units: groundForcesOn(state, planet, content.units, (o) => o !== player)
            .slice(0, effect.count)
            .map((unit) => unit.id),
        })),
      ),
  },
  repairUnits: {
    targets: () => ({}),
    usable: ({ state, player }) => unitsOnBoard(state, player).some((unit) => unit.damaged),
    resolve: ({ player }) => [{ type: 'UnitsRepaired', player }],
  },
} as const satisfies Pick<
  EffectRules,
  | 'readyPlanets'
  | 'recallToken'
  | 'placeUnits'
  | 'exhaustForeignPlanet'
  | 'destroyGroundForce'
  | 'repairUnits'
>;

const NO_POOLS = { tactic: 0, fleet: 0, strategy: 0 };
