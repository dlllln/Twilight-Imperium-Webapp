import { combatShooters } from '../combat/combat-queries.ts';
import { rollVolley, type Shooter, type Volley } from '../combat/dice.ts';
import { suggestHitAssignment } from '../combat/hit-assignment.ts';
import type { DecisionContext } from '../eventsourcing/command.ts';
import { chain } from '../game/event-chain.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import { findCapability, isStructure } from '../unit/unit-capabilities.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { Unit } from '../unit/unit.ts';
import { groundForcesOn } from './invasion-queries.ts';

const sides = (state: GameState, planet: PlanetId, attacker: PlayerId, catalog: UnitCatalog) => ({
  mine: groundForcesOn(state, planet, catalog, (id) => id === attacker),
  theirs: groundForcesOn(state, planet, catalog, (id) => id !== attacker),
});

const cannonsOn = (units: readonly Unit[], catalog: UnitCatalog): readonly Shooter[] =>
  units.flatMap((unit) => {
    const definition = catalog.find(unit.type);
    const cannon = definition === undefined ? undefined : findCapability(definition, 'spaceCannon');
    return cannon === undefined ? [] : [{ unit, profile: cannon.profile }];
  });

/** RR 87.7: Fremde Weltraumkanonen auf dem Planeten schießen auf die Gelandeten. */
function defenseFire(
  state: GameState,
  planet: PlanetId,
  attacker: PlayerId,
  { random, content }: DecisionContext,
): readonly GameEvent[] {
  const foreign = (state.planets[planet]?.units ?? []).filter((unit) => unit.owner !== attacker);
  const shooters = cannonsOn(foreign, content.units);
  const landed = sides(state, planet, attacker, content.units).mine;
  const owner = shooters[0]?.unit.owner;
  if (owner === undefined || landed.length === 0) return [];
  const sidesOfVolley = { player: owner, target: attacker };
  const volley = rollVolley(random, state.config.rules.dieSides, shooters, sidesOfVolley);
  const { destroyed } = suggestHitAssignment(landed, volley.hits, content.units);
  return [{ type: 'SpaceCannonDefenseFired', planet, volley, destroyed }];
}

/** Treffer jeder Seite: erst Schadensresistenz, dann die günstigsten Einheiten. */
function bothHit(
  mine: readonly Unit[],
  theirs: readonly Unit[],
  volleys: readonly Volley[],
  catalog: UnitCatalog,
) {
  const hits = [
    suggestHitAssignment(mine, volleys[1]?.hits ?? 0, catalog),
    suggestHitAssignment(theirs, volleys[0]?.hits ?? 0, catalog),
  ];
  return {
    sustained: hits.flatMap((h) => h.sustained),
    destroyed: hits.flatMap((h) => h.destroyed),
  };
}

function groundRound(
  state: GameState,
  planet: PlanetId,
  attacker: PlayerId,
  round: number,
  { random, content }: DecisionContext,
): GameEvent {
  const catalog = content.units;
  const { mine, theirs } = sides(state, planet, attacker, catalog);
  const defender = theirs[0]?.owner ?? attacker;
  const roll = (units: readonly Unit[], player: PlayerId, target: PlayerId) =>
    rollVolley(random, state.config.rules.dieSides, combatShooters(units, catalog), {
      player,
      target,
    });
  const volleys = [roll(mine, attacker, defender), roll(theirs, defender, attacker)];
  const hits = bothHit(mine, theirs, volleys, catalog);
  return { type: 'GroundCombatRoundRolled', planet, round, volleys, ...hits };
}

const winnerOf = (mine: readonly Unit[], theirs: readonly Unit[], attacker: PlayerId) =>
  mine.length > 0 ? attacker : (theirs[0]?.owner ?? null);

/** RR 25.4: Bodenkampf in Runden, bis höchstens eine Seite Bodentruppen hat. */
export function groundCombat(
  state: GameState,
  planet: PlanetId,
  attacker: PlayerId,
  decision: DecisionContext,
  round = 1,
): readonly GameEvent[] {
  const { mine, theirs } = sides(state, planet, attacker, decision.content.units);
  const fighting = mine.length > 0 && theirs.length > 0;
  if (!fighting && round === 1) return [];
  if (!fighting)
    return [{ type: 'GroundCombatEnded', planet, winner: winnerOf(mine, theirs, attacker) }];
  const rolled = groundRound(state, planet, attacker, round, decision);
  const after = evolveGame(state, rolled);
  return [rolled, ...groundCombat(after, planet, attacker, decision, round + 1)];
}

/** RR 25.5: Wer mit Bodentruppen auf dem Planeten steht, übernimmt die Kontrolle. */
function controlEvents(
  state: GameState,
  planet: PlanetId,
  player: PlayerId,
  catalog: UnitCatalog,
): readonly GameEvent[] {
  const planetState = state.planets[planet];
  const holds = sides(state, planet, player, catalog).mine.length > 0;
  if (planetState === undefined || !holds || planetState.controller === player) return [];
  const structuresDestroyed = planetState.units
    .filter((unit) => {
      const definition = catalog.find(unit.type);
      return unit.owner !== player && definition !== undefined && isStructure(definition);
    })
    .map((unit) => unit.id);
  return [{ type: 'PlanetControlGained', player, planet, structuresDestroyed }];
}

/** Abwehrfeuer, Bodenkampf und Kontrolle für einen Planeten mit gelandeten Truppen. */
export const resolveLanding = (
  state: GameState,
  planet: PlanetId,
  player: PlayerId,
  decision: DecisionContext,
): readonly GameEvent[] =>
  chain(state, [
    (current) => defenseFire(current, planet, player, decision),
    (current) => groundCombat(current, planet, player, decision),
    (current) => controlEvents(current, planet, player, decision.content.units),
  ]);
