import { rollVolley, type Shooter } from '../combat/dice.ts';
import { evaluatePayment, NO_PAYMENT, type Payment, paymentEvents } from '../economy/payment.ts';
import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { chain } from '../game/event-chain.ts';
import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import { type DomainError, domainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { PlanetId, SystemId } from '../shared/ids.ts';
import { andThen, err, map, ok, type Result } from '../shared/result.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import { tacticalStepCheck } from '../tactical/tactical-commands.ts';
import { reachNext } from '../tactical/tactical-steps.ts';
import { resolveLanding } from './ground-combat.ts';
import type { PlanetAssignment } from './invasion-events.ts';
import {
  bombardablePlanets,
  bombardingShips,
  bombardmentOf,
  groundForcesOn,
  isCenterSystem,
  landingForces,
} from './invasion-queries.ts';

/** RR 20.1: Jede Einheit mit Bombardement wählt höchstens einen Planeten. */
export interface Bombard extends Command<'Bombard'> {
  readonly targets: readonly PlanetAssignment[];
}

/** RR 25.2: Bodentruppen aus dem Weltraum landen auf Planeten; leer heißt „kein Einmarsch“. */
export interface CommitGroundForces extends Command<'CommitGroundForces'> {
  readonly landings: readonly PlanetAssignment[];
  /** Einfluss für den Marker der Thronwelt, falls dort gelandet wird. */
  readonly centerPayment: Payment | null;
}

type Events = Result<readonly GameEvent[], DomainError>;

const activeSystem = (state: GameState): Result<SystemId, DomainError> => {
  const system = state.actionPhase?.tactical?.system;
  return system === undefined
    ? err(domainError('tactical.notActive', 'Keine Taktikaktion aktiv'))
    : ok(system);
};

const uniqueUnits = (assignments: readonly PlanetAssignment[]) =>
  guard(
    new Set(assignments.map((a) => a.unit)).size === assignments.length,
    'invasion.duplicateUnit',
    'Einheit doppelt angegeben',
  );

const planetsOf = (assignments: readonly PlanetAssignment[]): readonly PlanetId[] => [
  ...new Set(assignments.map((a) => a.planet)),
];

function bombardChecks(state: GameState, command: Bombard, system: SystemId, ctx: DecisionContext) {
  const catalog = ctx.content.units;
  const ships = bombardingShips(state, system, command.issuedBy, catalog).map((u) => u.id);
  const planets = bombardablePlanets(state, system, command.issuedBy, catalog);
  return firstFailure([
    tacticalStepCheck(state, command, 'bombardment'),
    uniqueUnits(command.targets),
    guard(
      command.targets.every((t) => ships.includes(t.unit)),
      'invasion.cannotBombard',
      'Diese Einheit kann nicht bombardieren',
    ),
    guard(
      command.targets.every((t) => planets.includes(t.planet)),
      'invasion.invalidBombardTarget',
      'Dieser Planet kann nicht bombardiert werden',
    ),
  ]);
}

function bombardShooters(
  state: GameState,
  system: SystemId,
  planet: PlanetId,
  command: Bombard,
  catalog: UnitCatalog,
): readonly Shooter[] {
  const space = state.systems[system]?.spaceUnits ?? [];
  return command.targets
    .filter((target) => target.planet === planet)
    .flatMap(({ unit }) => {
      const ship = space.find((candidate) => candidate.id === unit);
      const bombardment = ship === undefined ? undefined : bombardmentOf(ship, catalog);
      return ship === undefined || bombardment === undefined
        ? []
        : [{ unit: ship, profile: bombardment.profile }];
    });
}

/** RR 20.1/20.2: Je Planet ein Wurf aller zugeteilten Einheiten; Treffer zerstören Bodentruppen. */
function bombardPlanet(
  state: GameState,
  system: SystemId,
  planet: PlanetId,
  command: Bombard,
  { random, content }: DecisionContext,
): readonly GameEvent[] {
  const player = command.issuedBy;
  const shooters = bombardShooters(state, system, planet, command, content.units);
  const defenders = groundForcesOn(state, planet, content.units, (id) => id !== player);
  const target = defenders[0]?.owner ?? player;
  const volley = rollVolley(random, state.config.rules.dieSides, shooters, { player, target });
  const destroyed = defenders.slice(0, volley.hits).map((unit) => unit.id);
  return [{ type: 'BombardmentRolled', system, planet, volley, destroyed }];
}

export const bombardHandler = {
  commandType: 'Bombard',
  decide(state: GameState, command: Bombard, decision: DecisionContext): Events {
    return andThen(activeSystem(state), (system) =>
      map(bombardChecks(state, command, system, decision), () =>
        chain(state, [
          ...planetsOf(command.targets).map(
            (planet) => (current: GameState) =>
              bombardPlanet(current, system, planet, command, decision),
          ),
          (current) => [reachNext(current, 'bombardment', decision.content)],
        ]),
      ),
    );
  },
} as const satisfies CommandHandler<GameState, Bombard, GameEvent>;

const needsCenterToken = (
  state: GameState,
  command: CommitGroundForces,
  system: SystemId,
  content: ContentPort,
): boolean =>
  command.landings.length > 0 && isCenterSystem(content.tiles, system) && !state.centerTokenRemoved;

/** Thronwelt: Wer dort landen will, gibt zuerst Einfluss aus und erhält Siegpunkte (RR 25, RR 55). */
function centerEvents(
  state: GameState,
  command: CommitGroundForces,
  system: SystemId,
  { content }: DecisionContext,
): Events {
  if (!needsCenterToken(state, command, system, content)) return ok([]);
  const { centerTokenInfluenceCost: required, centerTokenVictoryPoints: victoryPoints } =
    state.config.rules;
  const { issuedBy: player } = command;
  const payment = command.centerPayment ?? NO_PAYMENT;
  const removed: GameEvent = { type: 'CenterTokenRemoved', player, victoryPoints };
  return andThen(evaluatePayment(state, content.tiles, player, payment, 'influence'), (value) =>
    value < required
      ? err(domainError('invasion.centerPayment', 'Zu wenig Einfluss', { required }))
      : ok([...paymentEvents(player, payment), removed]),
  );
}

function landingChecks(
  state: GameState,
  command: CommitGroundForces,
  system: SystemId,
  ctx: DecisionContext,
) {
  const forces = landingForces(state, system, command.issuedBy, ctx.content.units);
  const ids = new Set(forces.map((unit) => unit.id));
  const planets = state.systems[system]?.planetIds ?? [];
  const { landings } = command;
  const landable = landings.every((l) => ids.has(l.unit));
  const inSystem = landings.every((l) => planets.includes(l.planet));
  return firstFailure([
    tacticalStepCheck(state, command, 'invasion'),
    uniqueUnits(landings),
    guard(landable, 'invasion.notLandable', 'Nur eigene Bodentruppen im Weltraum'),
    guard(inSystem, 'invasion.unknownPlanet', 'Der Planet liegt nicht im aktiven System'),
  ]);
}

function invasionEvents(
  state: GameState,
  command: CommitGroundForces,
  system: SystemId,
  center: readonly GameEvent[],
  decision: DecisionContext,
): readonly GameEvent[] {
  const { issuedBy: player, landings } = command;
  const committed: GameEvent = { type: 'GroundForcesCommitted', player, system, landings };
  const landing = (planet: PlanetId) => (current: GameState) =>
    resolveLanding(current, planet, player, decision);
  return chain(state, [
    () => (landings.length === 0 ? [] : [...center, committed]),
    ...planetsOf(landings).map(landing),
    (current) => [reachNext(current, 'invasion', decision.content)],
  ]);
}

export const commitGroundForcesHandler = {
  commandType: 'CommitGroundForces',
  decide(state: GameState, command: CommitGroundForces, decision: DecisionContext): Events {
    return andThen(activeSystem(state), (system) =>
      andThen(landingChecks(state, command, system, decision), () =>
        map(centerEvents(state, command, system, decision), (center) =>
          invasionEvents(state, command, system, center, decision),
        ),
      ),
    );
  },
} as const satisfies CommandHandler<GameState, CommitGroundForces, GameEvent>;
