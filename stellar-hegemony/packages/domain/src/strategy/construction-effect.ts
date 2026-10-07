import type { GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import type { StructuresPlaced } from '../production/production-events.ts';
import { ownedOnBoard } from '../production/production.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { PlanetId, PlayerId, SystemId, UnitTypeId } from '../shared/ids.ts';
import { andThen, err, map, type Result } from '../shared/result.ts';
import { hasCapability, isStructure } from '../unit/unit-capabilities.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { CapabilityKind } from '../unit/unit-definition.ts';
import { UnitNumbering } from '../unit/unit-numbering.ts';
import {
  choiceOf,
  type ConstructionChoice,
  type EffectInput,
  type StrategyEffect,
  type StructurePlacement,
} from './strategy-effect.ts';

type Events = Result<readonly GameEvent[], DomainError>;

const structureWith = (catalog: UnitCatalog, type: UnitTypeId, kind: CapabilityKind): boolean => {
  const definition = catalog.find(type);
  return definition !== undefined && isStructure(definition) && hasCapability(definition, kind);
};

/** Gebäude einer Art auf einem Planeten nach dem Bauen (vorhandene plus neue). */
function countOn(
  state: GameState,
  planet: PlanetId,
  placements: readonly StructurePlacement[],
  test: (type: UnitTypeId) => boolean,
): number {
  const existing = (state.planets[planet]?.units ?? []).filter((unit) => test(unit.type)).length;
  return existing + placements.filter((p) => p.planet === planet && test(p.type)).length;
}

/** RR 9 (Gebäude): höchstens ein Gebäude mit Produktion und zwei mit Weltraumkanone je Planet. */
function planetLimits(input: EffectInput, placements: readonly StructurePlacement[]): boolean {
  const { state, context } = input;
  const { maxProductionStructuresPerPlanet, maxCannonStructuresPerPlanet } = state.config.rules;
  const catalog = context.content.units;
  const docks = (type: UnitTypeId) => structureWith(catalog, type, 'production');
  const cannons = (type: UnitTypeId) => structureWith(catalog, type, 'spaceCannon');
  return placements.every(
    ({ planet }) =>
      countOn(state, planet, placements, docks) <= maxProductionStructuresPerPlanet &&
      countOn(state, planet, placements, cannons) <= maxCannonStructuresPerPlanet,
  );
}

function supplyLeft(input: EffectInput, placements: readonly StructurePlacement[]): boolean {
  return placements.every(({ type }) => {
    const limit = input.context.content.units.find(type)?.componentLimit ?? 0;
    const wanted = placements.filter((p) => p.type === type).length;
    return limit === 'unlimited' || ownedOnBoard(input.state, input.player, type) + wanted <= limit;
  });
}

function placementChecks(input: EffectInput, placements: readonly StructurePlacement[]): Check {
  const { state, player, context } = input;
  const catalog = context.content.units;
  const structures = placements.every(({ type }) => {
    const definition = catalog.find(type);
    return definition !== undefined && isStructure(definition);
  });
  const own = placements.every(({ planet }) => state.planets[planet]?.controller === player);
  const room = planetLimits(input, placements);
  const supply = supplyLeft(input, placements);
  return firstFailure([
    guard(structures, 'construction.notStructure', 'Nur Gebäude'),
    guard(own, 'construction.notYourPlanet', 'Nur auf eigenen Planeten'),
    guard(room, 'construction.planetFull', 'Kein Platz mehr auf dem Planeten'),
    guard(supply, 'construction.componentLimit', 'Keine Gebäude mehr im Vorrat'),
  ]);
}

function placedEvent(
  state: GameState,
  player: PlayerId,
  placements: readonly StructurePlacement[],
): StructuresPlaced {
  const stacks = placements.map(({ type }) => ({ type, count: 1 }));
  const units = new UnitNumbering(state.nextUnitNumber).create(player, stacks);
  const placed = placements.flatMap(({ planet }, index) => {
    const unit = units[index];
    return unit === undefined ? [] : [{ planet, unit }];
  });
  return { type: 'StructuresPlaced', player, placements: placed };
}

/** Ob irgendein Gebäude auf irgendeinen eigenen Planeten passt. */
function anyPlacement(input: EffectInput): boolean {
  const types = input.context.content.units.all(input.player).filter(isStructure);
  const planets = Object.values(input.state.planets).filter((p) => p.controller === input.player);
  return planets.some((planet) =>
    types.some((type) => placementChecks(input, [{ type: type.id, planet: planet.id }]).ok),
  );
}

/** RR 27.11: Passt nirgends ein Gebäude, bleibt die Fähigkeit ohne Wirkung; die Karte ist genutzt. */
const fewestPlacements = (input: EffectInput): number => (anyPlacement(input) ? 1 : 0);

/** Primär: ein Gebäude, danach optional eines mit Weltraumkanone. */
function primaryShape(input: EffectInput, choice: ConstructionChoice): Check {
  const [, second] = choice.placements;
  const catalog = input.context.content.units;
  const most = input.card.parameters.structures ?? 1;
  const count = choice.placements.length;
  return firstFailure([
    guard(
      count >= fewestPlacements(input) && count <= most,
      'construction.count',
      'Ein oder zwei Gebäude',
    ),
    guard(
      second === undefined || structureWith(catalog, second.type, 'spaceCannon'),
      'construction.secondCannon',
      'Das zweite Gebäude braucht eine Weltraumkanone',
    ),
  ]);
}

function primary(input: EffectInput): Events {
  return andThen(choiceOf(input, 'construction'), (choice) =>
    map(
      andThen(primaryShape(input, choice), () => placementChecks(input, choice.placements)),
      () => [placedEvent(input.state, input.player, choice.placements)],
    ),
  );
}

/** Sekundär: Marker aus dem Nachschub ins System, dort ein Gebäude auf einem eigenen Planeten. */
function secondaryChecks(input: EffectInput, choice: ConstructionChoice, id: SystemId): Check {
  const { state, player } = input;
  const system = state.systems[id];
  const [placement] = choice.placements;
  const inSystem = placement !== undefined && system?.planetIds.includes(placement.planet) === true;
  const reinforcements = findPlayer(state, player)?.reinforcementTokens ?? 0;
  return firstFailure([
    guard(choice.placements.length === 1, 'construction.count', 'Genau ein Gebäude'),
    guard(inSystem, 'construction.wrongSystem', 'Das Gebäude kommt in das gewählte System'),
    guard(
      system?.commandTokens.includes(player) !== true,
      'construction.tokenPresent',
      'Dort liegt schon dein Marker',
    ),
    guard(reinforcements > 0, 'construction.noReinforcements', 'Kein Marker im Nachschub'),
  ]);
}

function secondary(input: EffectInput): Events {
  return andThen(choiceOf(input, 'construction'), (choice) => {
    const { system } = choice;
    if (system === null) return err(domainError('construction.wrongSystem', 'System wählen'));
    const checked = andThen(secondaryChecks(input, choice, system), () =>
      placementChecks(input, choice.placements),
    );
    const token: GameEvent = {
      type: 'CommandTokensPlaced',
      system,
      placements: [{ player: input.player, source: 'reinforcements' }],
    };
    return map(checked, () => [token, placedEvent(input.state, input.player, choice.placements)]);
  });
}

export const constructionEffect: StrategyEffect = { mechanic: 'construction', primary, secondary };
