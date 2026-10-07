import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import type { SystemState } from '../galaxy/system-state.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { PlanetState } from '../planet/planet-state.ts';
import type { SystemId, UnitId } from '../shared/ids.ts';
import type { Unit } from '../unit/unit.ts';
import type {
  ShipsMoved,
  SystemActivated,
  TacticalEvent,
  UnitsDestroyed,
} from './tactical-events.ts';

type Systems = Record<string, SystemState>;
type Planets = Record<string, PlanetState>;

export function updateSystem(
  systems: Systems,
  id: SystemId,
  update: (s: SystemState) => SystemState,
) {
  const system = systems[id];
  if (system !== undefined) systems[id] = update(system);
}

function activate(state: GameState, event: SystemActivated): GameState {
  const systems: Systems = { ...state.systems };
  updateSystem(systems, event.system, (s) => ({
    ...s,
    commandTokens: [...s.commandTokens, event.player],
  }));
  const spent = updatePlayer({ ...state, systems }, event.player, (p) => ({
    ...p,
    commandPools: { ...p.commandPools, tactic: p.commandPools.tactic - 1 },
  }));
  const turn = spent.actionPhase;
  if (turn === null) return spent;
  const tactical = {
    system: event.system,
    step: 'movement',
    pendingHits: [],
    combat: null,
  } as const;
  return { ...spent, actionPhase: { ...turn, tactical } };
}

/** Nimmt Einheiten aus Weltraum und Planeten heraus und liefert sie zurück. */
export function takeUnits(systems: Systems, planets: Planets, ids: ReadonlySet<UnitId>): Unit[] {
  const moving = (unit: Unit) => ids.has(unit.id);
  const staying = (unit: Unit) => !ids.has(unit.id);
  const all = [
    ...Object.values(systems).flatMap((system) => system.spaceUnits),
    ...Object.values(planets).flatMap((planet) => planet.units),
  ];
  for (const [id, system] of Object.entries(systems))
    systems[id] = { ...system, spaceUnits: system.spaceUnits.filter(staying) };
  for (const [id, planet] of Object.entries(planets))
    planets[id] = { ...planet, units: planet.units.filter(staying) };
  return all.filter(moving);
}

function moveShips(state: GameState, event: ShipsMoved): GameState {
  const systems: Systems = { ...state.systems };
  const planets: Planets = { ...state.planets };
  const ids = new Set(event.movements.flatMap((m) => [m.ship, ...m.cargo.map((c) => c.unit)]));
  const moving = takeUnits(systems, planets, ids);
  updateSystem(systems, event.system, (s) => ({ ...s, spaceUnits: [...s.spaceUnits, ...moving] }));
  return { ...state, systems, planets };
}

function destroy(state: GameState, event: UnitsDestroyed): GameState {
  const systems: Systems = { ...state.systems };
  const planets: Planets = { ...state.planets };
  takeUnits(systems, planets, new Set(event.units));
  return { ...state, systems, planets };
}

export const tacticalReducers: ReducerMap<GameState, TacticalEvent> = {
  SystemActivated: activate,
  ShipsMoved: moveShips,
  GravityRiftRolled: (state) => state,
  UnitsDestroyed: destroy,
  TacticalActionEnded: (state) => state,
};
