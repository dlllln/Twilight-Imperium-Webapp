import { adjacentSystemIds } from '../galaxy/adjacency.ts';
import type { SystemState } from '../galaxy/system-state.ts';
import type { SystemId, UnitId } from '../shared/ids.ts';
import { canMove, isShip } from '../unit/unit-capabilities.ts';
import type { Unit } from '../unit/unit.ts';
import { locateUnit } from './board-queries.ts';
import { baseMove, canEnter, isGravityRift } from './route-rules.ts';
import type { MoveContext } from './ship-move-validator.ts';

interface Node {
  readonly system: SystemState;
  readonly remaining: number;
  readonly path: readonly SystemId[];
}

const riftBonus = (context: MoveContext, system: SystemState): number =>
  isGravityRift(system) ? context.rules.gravityRiftMoveBonus : 0;

function successors(context: MoveContext, node: Node): readonly Node[] {
  if (node.remaining < 1) return [];
  const { systems } = context.state;
  return adjacentSystemIds(systems, node.system).flatMap((id) => {
    const next = systems[id];
    const isDestination = id === context.active;
    if (next === undefined || !canEnter(next, context.player, isDestination, context.catalog))
      return [];
    const remaining = node.remaining - 1 + (isDestination ? 0 : riftBonus(context, next));
    return [{ system: next, remaining, path: [...node.path, id] }];
  });
}

function search(context: MoveContext, start: Node): readonly SystemId[] | undefined {
  const best = new Map<SystemId, number>([[start.system.id, start.remaining]]);
  const queue: Node[] = [start];
  for (let node = queue.shift(); node !== undefined; node = queue.shift()) {
    const next = successors(context, node);
    const arrived = next.find((candidate) => candidate.system.id === context.active);
    if (arrived !== undefined) return arrived.path;
    const fresh = next.filter(
      (candidate) => (best.get(candidate.system.id) ?? -1) < candidate.remaining,
    );
    for (const candidate of fresh) best.set(candidate.system.id, candidate.remaining);
    queue.push(...fresh);
  }
  return undefined;
}

/**
 * Pure Fabrication: kürzeste regelkonforme Route eines Schiffs ins aktive
 * System (Breitensuche; Gravitationsstrudel erhöhen das verbleibende Budget).
 */
export function findShipPath(context: MoveContext, ship: UnitId): readonly SystemId[] | undefined {
  const location = locateUnit(context.state, ship);
  const origin = location === undefined ? undefined : context.state.systems[location.system];
  const definition =
    location === undefined
      ? undefined
      : context.catalog.find(location.unit.type, location.unit.owner);
  if (origin === undefined || definition === undefined) return undefined;
  const remaining = baseMove(definition, origin, context.rules) + riftBonus(context, origin);
  return search(context, { system: origin, remaining, path: [] });
}

export interface MovementOption {
  readonly ship: Unit;
  readonly from: SystemId;
  readonly path: readonly SystemId[];
}

/** Alle eigenen Schiffe außerhalb des aktiven Systems, die es erreichen können. */
export function movementOptions(context: MoveContext): readonly MovementOption[] {
  return Object.values(context.state.systems)
    .filter(
      (system) => system.id !== context.active && !system.commandTokens.includes(context.player),
    )
    .flatMap((system) =>
      system.spaceUnits.flatMap((unit) => {
        const definition = context.catalog.find(unit.type, unit.owner);
        const movable =
          unit.owner === context.player &&
          definition !== undefined &&
          isShip(definition) &&
          canMove(definition);
        const path = movable ? findShipPath(context, unit.id) : undefined;
        return path === undefined ? [] : [{ ship: unit, from: system.id, path }];
      }),
    );
}
