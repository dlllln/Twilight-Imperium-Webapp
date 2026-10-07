import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlayerId } from '../shared/ids.ts';
import { fleetLimitOf } from '../technology/technology-catalog.ts';
import { countsTowardFleetLimit } from '../unit/unit-capabilities.ts';
import type { Unit } from '../unit/unit.ts';
import type { SystemState } from './system-state.ts';
import { excessCargo } from '../combat/space-combat.ts';
import { chain } from '../game/event-chain.ts';

const costOf = (unit: Unit, content: ContentPort): number => {
  const cost = content.units.find(unit.type, unit.owner)?.cost;
  return cost === undefined ? 0 : cost.resources / cost.unitsPerCost;
};

/** Nicht-Jäger-Schiffe über dem Flottenlimit, die günstigsten zuerst. */
function surplus(
  state: GameState,
  system: SystemState,
  player: PlayerId,
  content: ContentPort,
): readonly Unit[] {
  const ships = system.spaceUnits.filter((unit) => {
    const definition = content.units.find(unit.type, unit.owner);
    return unit.owner === player && definition !== undefined && countsTowardFleetLimit(definition);
  });
  const excess = ships.length - fleetLimitOf(state, player, content);
  if (excess <= 0) return [];
  return [...ships].sort((a, b) => costOf(a, content) - costOf(b, content)).slice(0, excess);
}

/** RR 28.3: überzählige Nicht-Jäger-Schiffe je System, ohne Wahl die günstigsten. */
function fleetEvents(state: GameState, content: ContentPort): readonly GameEvent[] {
  return Object.values(state.systems).flatMap((system) => {
    const units = state.players.flatMap((player) => surplus(state, system, player.id, content));
    return units.length === 0
      ? []
      : [
          {
            type: 'UnitsDestroyed',
            system: system.id,
            units: units.map((unit) => unit.id),
          } as const,
        ];
  });
}

/**
 * RR 43.3/43.4: überzählige Jäger und Bodentruppen im Weltraum, etwa wenn ein Raumdock
 * mit Hangar verloren geht. Im aktiven System prüfen Bewegung und Kampfende selbst.
 */
function capacityEvents(state: GameState, content: ContentPort): readonly GameEvent[] {
  const active = state.actionPhase?.tactical?.system;
  return chain(
    state,
    Object.values(state.systems)
      .filter((system) => system.id !== active)
      .flatMap((system) =>
        state.players.map(
          (player) => (current: GameState) =>
            excessCargo(current, system.id, player.id, content.units),
        ),
      ),
  );
}

/**
 * Pure Fabrication: Grenzen, die „zu jedem Zeitpunkt“ gelten (Flottenlimit, Kapazität),
 * werden nach jedem Command wiederhergestellt; erst die Schiffe, dann ihre Fracht.
 */
export function boardLimitEvents(state: GameState, content: ContentPort): readonly GameEvent[] {
  return chain(state, [
    (current) => fleetEvents(current, content),
    (current) => capacityEvents(current, content),
  ]);
}
