import type { TokenPlacement } from '../economy/economy-events.ts';
import type { SystemState } from '../galaxy/system-state.ts';
import type { TileCatalog } from '../galaxy/tile-catalog.ts';
import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import { tokenSourceOf } from '../economy/token-source.ts';
import { type DomainError, domainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import { andThen, err, map, ok, type Result } from '../shared/result.ts';
import {
  choiceOf,
  type DiplomacyChoice,
  type EffectInput,
  type StrategyEffect,
} from './strategy-effect.ts';

type Events = Result<readonly GameEvent[], DomainError>;

const controls = (state: GameState, player: PlayerId, planet: PlanetId): boolean =>
  state.planets[planet]?.controller === player;

const exhaustedOwn = (state: GameState, player: PlayerId, planets: readonly PlanetId[]) =>
  planets.filter((id) => controls(state, player, id) && state.planets[id]?.exhausted === true);

/** RR 21.3: die eigenen erschöpften Planeten, die die Diplomatie bereitmachen kann. */
export function readyablePlanets(state: GameState, player: PlayerId): readonly PlanetId[] {
  return Object.values(state.planets)
    .filter((planet) => planet.controller === player && planet.exhausted)
    .map((planet) => planet.id);
}

function placements(
  state: GameState,
  system: SystemState,
  active: PlayerId,
): readonly TokenPlacement[] {
  return state.players
    .filter((player) => player.id !== active && !system.commandTokens.includes(player.id))
    .flatMap((player) => {
      const source = tokenSourceOf(player);
      return source === null ? [] : [{ player: player.id, source }];
    });
}

/**
 * RR 21.2: die Marker, die die Diplomatie im System ablegt: jeder andere Spieler ohne eigenen
 * Marker dort, sofern er noch einen aufbringen kann. Tisch und Effekt fragen hier nach.
 */
export function diplomacyPlacements(
  state: GameState,
  system: SystemId,
  active: PlayerId,
): readonly TokenPlacement[] {
  const found = state.systems[system];
  return found === undefined ? [] : placements(state, found, active);
}

function chosenSystem(
  input: EffectInput,
  choice: DiplomacyChoice,
): Result<SystemState, DomainError> {
  const { state, player, context } = input;
  const system = choice.system === null ? undefined : state.systems[choice.system];
  if (system === undefined) return err(domainError('diplomacy.unknownSystem', 'System wählen'));
  const isCenter = context.content.tiles.find(system.id)?.back === 'center';
  const ownsPlanet = system.planetIds.some((id) => controls(state, player, id));
  const checked = firstFailure([
    guard(!isCenter, 'diplomacy.center', 'Nicht das Zentrum'),
    guard(ownsPlanet, 'diplomacy.noPlanet', 'Kein eigener Planet dort'),
  ]);
  return map(checked, () => system);
}

/** RR 21.2: die Systeme, die die Diplomatie wählen darf: außerhalb des Zentrums mit eigenem Planeten. */
export function diplomacySystems(
  state: GameState,
  player: PlayerId,
  tiles: TileCatalog,
): readonly SystemId[] {
  return Object.values(state.systems)
    .filter((system) => tiles.find(system.id)?.back !== 'center')
    .filter((system) => system.planetIds.some((id) => controls(state, player, id)))
    .map((system) => system.id);
}

/** RR 27.11: Ohne eigenen Planeten außerhalb des Zentrums bleibt die Fähigkeit ohne Wirkung. */
const hasEligibleSystem = ({ state, player, context }: EffectInput): boolean =>
  diplomacySystems(state, player, context.content.tiles).length > 0;

/** RR 21.2: eigene Planeten im System bereitmachen, die anderen legen dort einen Marker ab. */
function primary(input: EffectInput): Events {
  const { state, player } = input;
  return andThen(choiceOf(input, 'diplomacy'), (choice) => {
    if (choice.system === null && !hasEligibleSystem(input)) return ok([]);
    return map(chosenSystem(input, choice), (system): readonly GameEvent[] => {
      const readied = exhaustedOwn(state, player, system.planetIds);
      return [
        ...(readied.length > 0
          ? [{ type: 'PlanetsReadied', player, planets: readied } as const]
          : []),
        {
          type: 'CommandTokensPlaced',
          system: system.id,
          placements: placements(state, system, player),
        },
      ];
    });
  });
}

/** RR 21.3: bis zu zwei eigene erschöpfte Planeten bereitmachen. */
function secondary(input: EffectInput): Events {
  const { state, player, card } = input;
  const limit = card.parameters.readyPlanets ?? 0;
  return andThen(choiceOf(input, 'diplomacy'), ({ planets }) => {
    const readyable = readyablePlanets(state, player);
    const checked = firstFailure([
      guard(planets.length <= limit, 'diplomacy.tooManyPlanets', 'Zu viele Planeten', { limit }),
      guard(new Set(planets).size === planets.length, 'payment.duplicatePlanet', 'Planet doppelt'),
      guard(
        planets.every((id) => readyable.includes(id)),
        'diplomacy.notExhausted',
        'Nur eigene erschöpfte Planeten',
      ),
    ]);
    if (!checked.ok) return checked;
    return ok(planets.length > 0 ? [{ type: 'PlanetsReadied', player, planets }] : []);
  });
}

export const diplomacyEffect: StrategyEffect = { mechanic: 'diplomacy', primary, secondary };
