import { bonusFor, boosted } from '../action-card/combat-bonus.ts';
import type { DecisionContext } from '../eventsourcing/command.ts';
import { tokenSourceOf } from '../economy/token-source.ts';
import { adjacentSystemIds } from '../galaxy/adjacency.ts';
import { StarSystem } from '../galaxy/star-system.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { ContentPort } from '../ports/content-port.ts';
import { reachNext } from '../tactical/tactical-steps.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import type { PlayerId, SystemId } from '../shared/ids.ts';
import { isGroundForce } from '../unit/unit-capabilities.ts';
import type { Unit } from '../unit/unit.ts';
import {
  barrageShooters,
  combatShooters,
  opponentWithShips,
  playersWithShips,
  shipsOf,
  unitsInSystem,
} from './combat-queries.ts';
import type { SpaceCombatState } from './combat-state.ts';
import { rollVolley } from './dice.ts';

type Catalog = DecisionContext['content']['units'];

/** RR 63.7: Ziel eines Rückzugs: angrenzend, ohne fremde Schiffe, mit eigener Einheit oder eigenem Planeten. */
export function retreatTargets(
  state: GameState,
  from: SystemId,
  player: PlayerId,
  catalog: Catalog,
): readonly SystemId[] {
  const origin = state.systems[from];
  if (origin === undefined) return [];
  return adjacentSystemIds(state.systems, origin).filter((id) => {
    const system = state.systems[id];
    if (system === undefined) return false;
    const foreignShips = playersWithShips(state, id, catalog).some((owner) => owner !== player);
    const ownUnit = unitsInSystem(state, system).some((unit) => unit.owner === player);
    const ownPlanet = system.planetIds.some((p) => state.planets[p]?.controller === player);
    return !foreignShips && (ownUnit || ownPlanet);
  });
}

/** RR 63.5 Schritt 1: Jägerabwehr beider Seiten gleichzeitig, Treffer zerstören Jäger. */
function barrage(
  state: GameState,
  system: SystemId,
  sides: { readonly player: PlayerId; readonly target: PlayerId },
  decision: DecisionContext,
): readonly GameEvent[] {
  const catalog = decision.content.units;
  const shooters = barrageShooters(shipsOf(state, system, sides.player, catalog), catalog);
  if (shooters.length === 0) return [];
  const volley = rollVolley(decision.random, state.config.rules.dieSides, shooters, sides);
  const fighters = shipsOf(state, system, sides.target, catalog).filter(
    (unit) => catalog.find(unit.type, unit.owner)?.isFighter === true,
  );
  const destroyed = fighters.slice(0, volley.hits).map((unit) => unit.id);
  return [{ type: 'AntiFighterBarrageFired', system, volley, destroyed }];
}

/** Beginn des Raumkampfs, sobald Angreifer und Verteidiger Schiffe im aktiven System haben. */
export function startSpaceCombat(
  state: GameState,
  system: SystemId,
  attacker: PlayerId,
  decision: DecisionContext,
): readonly GameEvent[] {
  const catalog = decision.content.units;
  const defender = opponentWithShips(state, system, attacker, catalog);
  if (defender === null || shipsOf(state, system, attacker, catalog).length === 0)
    return [reachNext(state, 'spaceCombat', decision.content)];
  return [
    { type: 'SpaceCombatStarted', system, attacker, defender },
    ...barrage(state, system, { player: attacker, target: defender }, decision),
    ...barrage(state, system, { player: defender, target: attacker }, decision),
  ];
}

export function nextRound(
  state: GameState,
  system: SystemId,
  combat: SpaceCombatState,
  catalog: Catalog,
): GameEvent {
  const awaitingRetreat = [combat.defender, combat.attacker].filter(
    (player) => retreatTargets(state, system, player, catalog).length > 0,
  );
  return { type: 'SpaceCombatRoundStarted', round: combat.round + 1, awaitingRetreat };
}

/** RR 63.5 Schritt 3: Kampfwürfe, Angreifer vor Verteidiger. */
export function rollRound(
  state: GameState,
  system: SystemId,
  combat: SpaceCombatState,
  decision: DecisionContext,
): GameEvent {
  const catalog = decision.content.units;
  const volleyOf = (player: PlayerId, target: PlayerId) => {
    const ships = combatShooters(shipsOf(state, system, player, catalog), catalog);
    const shooters = boosted(ships, bonusFor(state, player, 'space', combat.round));
    return rollVolley(decision.random, state.config.rules.dieSides, shooters, { player, target });
  };
  const volleys = [
    volleyOf(combat.attacker, combat.defender),
    volleyOf(combat.defender, combat.attacker),
  ];
  return { type: 'CombatRoundRolled', system, round: combat.round, volleys };
}

/** Einheiten, die mit einem Rückzug abziehen: Schiffe und Bodentruppen im Weltraum. */
function retreatingUnits(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  catalog: Catalog,
): readonly Unit[] {
  const carried = (unit: Unit) => {
    const definition = catalog.find(unit.type, unit.owner);
    return unit.owner === player && definition !== undefined && isGroundForce(definition);
  };
  const space = state.systems[system]?.spaceUnits ?? [];
  return [...shipsOf(state, system, player, catalog), ...space.filter(carried)];
}

/** RR 63.7: Schiffe und ihre Fracht im Weltraum ziehen sich zurück. */
export function retreatEvents(
  state: GameState,
  system: SystemId,
  combat: SpaceCombatState,
  catalog: Catalog,
): readonly GameEvent[] {
  const plan = combat.retreat;
  if (plan === null || shipsOf(state, system, plan.player, catalog).length === 0) return [];
  const units = retreatingUnits(state, system, plan.player, catalog).map((unit) => unit.id);
  const hasToken = state.systems[plan.to]?.commandTokens.includes(plan.player) === true;
  const player = findPlayer(state, plan.player);
  const token = hasToken || player === undefined ? null : tokenSourceOf(player);
  return [{ type: 'ShipsRetreated', player: plan.player, from: system, to: plan.to, units, token }];
}

interface Room {
  readonly ships: number;
  readonly hangars: number;
}

/**
 * Was keinen Platz hat: Bodentruppen belegen zuerst die Schiffskapazität, Jäger danach
 * Hangars und den Rest. Verloren gehen also zuerst Jäger, dann Bodentruppen.
 */
function overflowing(units: readonly Unit[], room: Room, catalog: Catalog): readonly Unit[] {
  const definition = (unit: Unit) => catalog.find(unit.type, unit.owner);
  const ground = units.filter((unit) => {
    const found = definition(unit);
    return found !== undefined && isGroundForce(found);
  });
  const fighters = units.filter((unit) => definition(unit)?.isFighter === true);
  const keptGround = Math.min(ground.length, room.ships);
  const keptFighters = room.hangars + room.ships - keptGround;
  const lost = (all: readonly Unit[], kept: number) => all.slice(0, Math.max(0, all.length - kept));
  return [...lost(fighters, keptFighters), ...lost(ground, keptGround)];
}

/**
 * RR 43.3/63.10: Überzählige Jäger und Bodentruppen eines Spielers im Weltraum gehen
 * verloren, etwa nach dem Kampf oder wenn Träger das System verlassen.
 */
export function excessCargo(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  catalog: Catalog,
): readonly GameEvent[] {
  const systemState = state.systems[system];
  if (systemState === undefined) return [];
  const planets = systemState.planetIds.flatMap((id) => state.planets[id] ?? []);
  const inspected = StarSystem.inspect(systemState, planets, catalog);
  if (!inspected.ok) return [];
  const { value } = inspected;
  const room = { ships: value.shipCapacity(player), hangars: value.hangarSpace(player) };
  const own = systemState.spaceUnits.filter((unit) => unit.owner === player);
  const lost = overflowing(own, room, catalog);
  return lost.length === 0
    ? []
    : [{ type: 'UnitsDestroyed', system, units: lost.map((u) => u.id) }];
}

/** RR 63.9: Der Kampf endet, sobald höchstens ein Spieler noch Schiffe hat. */
export function combatEnd(
  state: GameState,
  system: SystemId,
  combat: SpaceCombatState,
  content: ContentPort,
): readonly GameEvent[] | null {
  const fighting = [combat.attacker, combat.defender];
  const remaining = playersWithShips(state, system, content.units).filter((p) =>
    fighting.includes(p),
  );
  if (remaining.length > 1) return null;
  const winner = remaining[0] ?? null;
  const ended: readonly GameEvent[] = [
    { type: 'SpaceCombatEnded', system, winner },
    ...(winner === null ? [] : excessCargo(state, system, winner, content.units)),
  ];
  return [...ended, reachNext(ended.reduce(evolveGame, state), 'spaceCombat', content)];
}
