import {
  countsTowardFleetLimit,
  fleetLimitOf,
  isGroundForce,
  type MoveContext,
  type MovementOption,
  movementOptions,
  type ShipMoveOrder,
  type SystemId,
  type Unit,
  type UnitId,
} from '@stellar/domain';
import { type BotView, contentOf } from './bot-view.ts';

export const moveContext = (view: BotView, active: SystemId): MoveContext => ({
  state: view.state,
  player: view.player,
  active,
  catalog: contentOf(view).units,
  rules: view.state.config.rules,
});

const definitionOf = (view: BotView, unit: Unit) =>
  contentOf(view).units.find(unit.type, unit.owner);

/** Eigene Bodentruppen und Jäger im Herkunftssystem, Bodentruppen zuerst. */
function cargoAt(view: BotView, origin: SystemId): readonly Unit[] {
  const system = view.state.systems[origin];
  const onPlanets = (system?.planetIds ?? []).flatMap((id) => view.state.planets[id]?.units ?? []);
  const own = [...onPlanets, ...(system?.spaceUnits ?? [])].filter((u) => u.owner === view.player);
  const ground = own.filter((unit) => {
    const definition = definitionOf(view, unit);
    return definition !== undefined && isGroundForce(definition);
  });
  const fighters = own.filter((unit) => definitionOf(view, unit)?.isFighter === true);
  return [...ground, ...fighters];
}

/** Nicht-Jäger-Schiffe, die schon im aktiven System stehen (für das Flottenlimit). */
function fleetAt(view: BotView, active: SystemId): number {
  const units = view.state.systems[active]?.spaceUnits ?? [];
  return units.filter((unit) => {
    const definition = definitionOf(view, unit);
    return (
      unit.owner === view.player && definition !== undefined && countsTowardFleetLimit(definition)
    );
  }).length;
}

/** Schiffe, die mitfliegen: so viele, wie das Flottenlimit im Zielsystem zulässt (RR 28). */
function chosenShips(view: BotView, active: SystemId): readonly MovementOption[] {
  let room = fleetLimitOf(view.state, view.player, contentOf(view)) - fleetAt(view, active);
  return movementOptions(moveContext(view, active)).filter((option) => {
    const definition = definitionOf(view, option.ship);
    const counts = definition !== undefined && countsTowardFleetLimit(definition);
    if (counts) room -= 1;
    return !counts || room >= 0;
  });
}

/** RR 79.2: Schiffe ins aktive System, Träger nehmen Fracht aus ihrem Herkunftssystem mit. */
export function planMoves(view: BotView, active: SystemId): readonly ShipMoveOrder[] {
  const taken = new Set<UnitId>();
  return chosenShips(view, active).map((option) => {
    const capacity = definitionOf(view, option.ship)?.capacity ?? 0;
    const cargo = cargoAt(view, option.from)
      .filter((unit) => !taken.has(unit.id))
      .slice(0, capacity)
      .map((unit) => unit.id);
    for (const id of cargo) taken.add(id);
    return { ship: option.ship.id, path: option.path, cargo };
  });
}
