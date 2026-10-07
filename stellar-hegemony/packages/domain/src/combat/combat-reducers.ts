import { takeToken } from '../economy/economy-reducers.ts';
import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import type { SystemState } from '../galaxy/system-state.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { TacticalActionState } from '../phases/turn-state.ts';
import type { UnitId } from '../shared/ids.ts';
import { takeUnits, updateSystem } from '../tactical/tactical-reducers.ts';
import type {
  AntiFighterBarrageFired,
  CombatEvent,
  CombatRoundRolled,
  HitsAssigned,
  RetreatDeclared,
  ShipsRetreated,
  SpaceCannonFired,
  SpaceCombatRoundStarted,
  SpaceCombatStarted,
} from './combat-events.ts';
import type { PendingHits, SpaceCombatState } from './combat-state.ts';
import type { Volley } from './dice.ts';

type Systems = Record<string, SystemState>;

function withTactical(
  state: GameState,
  change: (tactical: TacticalActionState) => TacticalActionState,
): GameState {
  const turn = state.actionPhase;
  if (turn?.tactical == null) return state;
  return { ...state, actionPhase: { ...turn, tactical: change(turn.tactical) } };
}

function withCombat(
  state: GameState,
  change: (combat: SpaceCombatState) => SpaceCombatState,
): GameState {
  return withTactical(state, (tactical) =>
    tactical.combat === null ? tactical : { ...tactical, combat: change(tactical.combat) },
  );
}

/** Treffer desselben Ziels werden zusammengezählt. */
function addPending(pending: readonly PendingHits[], volleys: readonly Volley[]) {
  return volleys
    .filter((volley) => volley.hits > 0)
    .reduce<readonly PendingHits[]>((list, { target, hits }) => {
      const known = list.find((entry) => entry.player === target);
      if (known === undefined) return [...list, { player: target, hits }];
      return list.map((entry) => (entry === known ? { ...entry, hits: entry.hits + hits } : entry));
    }, pending);
}

const spaceCannonFired = (state: GameState, event: SpaceCannonFired) =>
  withTactical(state, (t) => ({ ...t, pendingHits: addPending(t.pendingHits, [event.volley]) }));

function removeUnits(state: GameState, ids: readonly UnitId[]): GameState {
  const systems: Systems = { ...state.systems };
  const planets = { ...state.planets };
  takeUnits(systems, planets, new Set(ids));
  return { ...state, systems, planets };
}

function damage(state: GameState, event: HitsAssigned): GameState {
  const systems: Systems = { ...state.systems };
  const hit = new Set(event.sustained);
  updateSystem(systems, event.system, (s) => ({
    ...s,
    spaceUnits: s.spaceUnits.map((u) => (hit.has(u.id) ? { ...u, damaged: true } : u)),
  }));
  return { ...state, systems };
}

function hitsAssigned(state: GameState, event: HitsAssigned): GameState {
  const resolved = removeUnits(damage(state, event), event.destroyed);
  return withTactical(resolved, (t) => ({
    ...t,
    pendingHits: t.pendingHits.filter((entry) => entry.player !== event.player),
  }));
}

const combatStarted = (state: GameState, event: SpaceCombatStarted) =>
  withTactical(state, (tactical) => ({
    ...tactical,
    combat: {
      attacker: event.attacker,
      defender: event.defender,
      // Runde 0: Jägerabwehr ist abgehandelt, Runde 1 beginnt mit dem Rückzugsschritt.
      round: 0,
      awaitingRetreat: [],
      retreat: null,
      rolled: false,
    },
  }));

/** Kündigt der Verteidiger einen Rückzug an, darf der Angreifer es nicht mehr (RR 63.5). */
const retreatDeclared = (state: GameState, event: RetreatDeclared) =>
  withCombat(state, (combat) => ({
    ...combat,
    retreat: event.to === null ? combat.retreat : { player: event.player, to: event.to },
    awaitingRetreat:
      event.to === null ? combat.awaitingRetreat.filter((id) => id !== event.player) : [],
  }));

function roundRolled(state: GameState, event: CombatRoundRolled): GameState {
  const rolled = withCombat(state, (combat) => ({ ...combat, rolled: true }));
  return withTactical(rolled, (t) => ({
    ...t,
    pendingHits: addPending(t.pendingHits, event.volleys),
  }));
}

function placeRetreatToken(state: GameState, event: ShipsRetreated): GameState {
  const source = event.token;
  if (source === null) return state;
  const systems: Systems = { ...state.systems };
  updateSystem(systems, event.to, (s) => ({
    ...s,
    commandTokens: [...s.commandTokens, event.player],
  }));
  return updatePlayer({ ...state, systems }, event.player, (p) => takeToken(p, source));
}

function retreated(state: GameState, event: ShipsRetreated): GameState {
  const systems: Systems = { ...state.systems };
  const planets = { ...state.planets };
  const moving = takeUnits(systems, planets, new Set(event.units));
  updateSystem(systems, event.to, (s) => ({ ...s, spaceUnits: [...s.spaceUnits, ...moving] }));
  return placeRetreatToken({ ...state, systems, planets }, event);
}

const roundStarted = (state: GameState, event: SpaceCombatRoundStarted) =>
  withCombat(state, (combat) => ({
    ...combat,
    round: event.round,
    awaitingRetreat: event.awaitingRetreat,
    retreat: null,
    rolled: false,
  }));

export const combatReducers: ReducerMap<GameState, CombatEvent> = {
  TacticalStepReached: (state, event) => withTactical(state, (t) => ({ ...t, step: event.step })),
  SpaceCannonFired: spaceCannonFired,
  HitsAssigned: hitsAssigned,
  SpaceCombatStarted: combatStarted,
  AntiFighterBarrageFired: (state, event: AntiFighterBarrageFired) =>
    removeUnits(state, event.destroyed),
  RetreatDeclared: retreatDeclared,
  CombatRoundRolled: roundRolled,
  ShipsRetreated: retreated,
  SpaceCombatRoundStarted: roundStarted,
  SpaceCombatEnded: (state) => withTactical(state, (t) => ({ ...t, combat: null })),
};
