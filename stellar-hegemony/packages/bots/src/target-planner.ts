import {
  findPlanetDefinition,
  groundForcesOn,
  homeSystemIdOf,
  isCenterSystem,
  isGroundForce,
  locateUnit,
  type GameCommand,
  type SystemId,
  type SystemState,
  type Unit,
} from '@stellar/domain';
import { type BotView, contentOf, issued, me } from './bot-view.ts';
import { strength } from './combat-planner.ts';
import { planMoves } from './move-planner.ts';
import { budget, planPayment } from './payment-planner.ts';

/** Ein Angriff lohnt sich erst mit deutlicher Übermacht. */
const SUPERIORITY = 1.5;
/** Produzieren daheim lohnt sich ab so vielen Ressourcen. */
const PRODUCTION_BUDGET = 3;
const HOME_VALUE = 1;

interface Arrival {
  readonly ships: readonly Unit[];
  readonly ground: number;
}

/** Welche Schiffe und wie viele Bodentruppen mit der geplanten Bewegung ankämen. */
function arrivalAt(view: BotView, target: SystemId): Arrival {
  const orders = planMoves(view, target);
  const unitOf = (id: Unit['id']) => locateUnit(view.state, id)?.unit;
  const ships = orders.flatMap((order) => unitOf(order.ship) ?? []);
  const cargo = orders.flatMap((order) => order.cargo.flatMap((id) => unitOf(id) ?? []));
  const ground = cargo.filter((unit) => {
    const definition = contentOf(view).units.find(unit.type, unit.owner);
    return definition !== undefined && isGroundForce(definition);
  }).length;
  return { ships, ground };
}

const enemyShips = (view: BotView, system: SystemState) =>
  system.spaceUnits.filter((unit) => unit.owner !== view.player);

/** Wert der fremden oder freien Planeten, die die Landetruppen erobern könnten. */
function planetValue(view: BotView, system: SystemState, ground: number): number {
  const catalog = contentOf(view).units;
  return system.planetIds
    .filter((id) => view.state.planets[id]?.controller !== view.player)
    .filter(
      (id) => groundForcesOn(view.state, id, catalog, (o) => o !== view.player).length < ground,
    )
    .reduce((sum, id) => {
      const definition = findPlanetDefinition(contentOf(view).tiles, id);
      return sum + 1 + (definition?.resources ?? 0) + (definition?.influence ?? 0);
    }, 0);
}

/** Die Thronwelt kostet Einfluss, solange ihr Marker liegt (RR 25.2). */
function centerAffordable(view: BotView, system: SystemState): boolean {
  if (!isCenterSystem(contentOf(view).tiles, system.id) || view.state.centerTokenRemoved)
    return true;
  const cost = view.state.config.rules.centerTokenInfluenceCost;
  return planPayment(view, 'influence', cost) !== null;
}

/** Bewertung eines Zielsystems; 0 heißt „nicht aktivieren“. */
export function targetValue(view: BotView, system: SystemState): number {
  if (system.commandTokens.includes(view.player) || !centerAffordable(view, system)) return 0;
  const arrival = arrivalAt(view, system.id);
  if (arrival.ships.length === 0) return 0;
  const { dieSides } = view.state.config.rules;
  const catalog = contentOf(view).units;
  const theirs = strength(enemyShips(view, system), catalog, dieSides);
  const mine = strength(arrival.ships, catalog, dieSides);
  if (theirs > 0 && mine < theirs * SUPERIORITY) return 0;
  return planetValue(view, system, arrival.ground) + theirs;
}

/** Heimatsystem aktivieren, um dort zu produzieren (RR 79.6). */
function homeTarget(view: BotView): readonly SystemId[] {
  const home = homeSystemIdOf(view.state, view.player, contentOf(view));
  const system = home === undefined ? undefined : view.state.systems[home];
  if (system === undefined || system.commandTokens.includes(view.player)) return [];
  return budget(view, 'resources') >= PRODUCTION_BUDGET ? [system.id] : [];
}

/** RR 79.1: Zielsysteme nach Wert, das eigene Heimatsystem als Rückfall. */
export function tacticalTargets(view: BotView): readonly GameCommand[] {
  if (me(view).commandPools.tactic === 0) return [];
  const ranked = Object.values(view.state.systems)
    .map((system) => ({ system: system.id, value: targetValue(view, system) }))
    .filter((target) => target.value > HOME_VALUE)
    .sort((a, b) => b.value - a.value)
    .map((target) => target.system);
  return [...ranked, ...homeTarget(view)].map((system) => ({
    type: 'ActivateSystem',
    ...issued(view),
    system,
  }));
}
