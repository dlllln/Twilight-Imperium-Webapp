import {
  bombardablePlanets,
  bombardingShips,
  groundForcesOn,
  isCenterSystem,
  landingForces,
  type GameCommand,
  type PlanetAssignment,
  type PlanetId,
  type SystemId,
} from '@stellar/domain';
import { type BotView, contentOf, issued } from './bot-view.ts';
import { planPayment } from './payment-planner.ts';

const activeSystem = (view: BotView): SystemId | undefined =>
  view.state.actionPhase?.tactical?.system;

const enemiesOn = (view: BotView, planet: PlanetId): number =>
  groundForcesOn(view.state, planet, contentOf(view).units, (owner) => owner !== view.player)
    .length;

/** RR 20: jedes Schiff mit Bombardement auf den Planeten mit den meisten fremden Truppen. */
export function bombardCommands(view: BotView): readonly GameCommand[] {
  const system = activeSystem(view);
  if (system === undefined) return [];
  const catalog = contentOf(view).units;
  const planets = [...bombardablePlanets(view.state, system, view.player, catalog)].sort(
    (a, b) => enemiesOn(view, b) - enemiesOn(view, a),
  );
  const target = planets[0];
  const ships = bombardingShips(view.state, system, view.player, catalog);
  const targets =
    target === undefined ? [] : ships.map((ship) => ({ unit: ship.id, planet: target }));
  return [
    { type: 'Bombard', ...issued(view), targets },
    { type: 'Bombard', ...issued(view), targets: [] },
  ];
}

/** Planeten, die erobert werden sollen: zuerst die schwächer verteidigten. */
function landingTargets(view: BotView, system: SystemId): readonly PlanetId[] {
  const planets = view.state.systems[system]?.planetIds ?? [];
  return planets
    .filter((planet) => view.state.planets[planet]?.controller !== view.player)
    .sort((a, b) => enemiesOn(view, a) - enemiesOn(view, b));
}

/**
 * RR 25.2: Jeder Zielplanet bekommt eine Truppe mehr als seine Verteidiger,
 * der Rest landet auf dem ersten Ziel.
 */
export function planLandings(view: BotView, system: SystemId): readonly PlanetAssignment[] {
  const forces = landingForces(view.state, system, view.player, contentOf(view).units);
  const targets = landingTargets(view, system);
  const first = targets[0];
  if (first === undefined) return [];
  let next = 0;
  const assignments: PlanetAssignment[] = [];
  for (const planet of targets) {
    const needed = enemiesOn(view, planet) + 1;
    if (forces.length - next < needed) continue;
    for (const unit of forces.slice(next, next + needed))
      assignments.push({ unit: unit.id, planet });
    next += needed;
  }
  return [...assignments, ...forces.slice(next).map((unit) => ({ unit: unit.id, planet: first }))];
}

export function invasionCommands(view: BotView): readonly GameCommand[] {
  const system = activeSystem(view);
  if (system === undefined) return [];
  const center = isCenterSystem(contentOf(view).tiles, system) && !view.state.centerTokenRemoved;
  const cost = view.state.config.rules.centerTokenInfluenceCost;
  const centerPayment = center ? planPayment(view, 'influence', cost) : null;
  const landings = planLandings(view, system);
  return [
    { type: 'CommitGroundForces', ...issued(view), landings, centerPayment },
    { type: 'CommitGroundForces', ...issued(view), landings: [], centerPayment: null },
  ];
}
