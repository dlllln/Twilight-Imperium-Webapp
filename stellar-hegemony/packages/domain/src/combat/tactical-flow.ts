import { clockwiseFrom, type GameState } from '../game/game-state.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { DecisionContext } from '../eventsourcing/command.ts';
import type { TacticalActionState } from '../phases/turn-state.ts';
import type { PlayerId, SystemId } from '../shared/ids.ts';
import {
  absorbableHits,
  opponentWithShips,
  shipsOf,
  spaceCannonShooters,
} from './combat-queries.ts';
import { rollVolley, type Volley } from './dice.ts';
import {
  combatEnd,
  nextRound,
  retreatEvents,
  rollRound,
  startSpaceCombat,
} from './space-combat.ts';

type Events = readonly GameEvent[];

/** Ziel einer Weltraumkanone: der aktive Spieler beschießt den Gegner, alle anderen den aktiven Spieler. */
function cannonTarget(
  state: GameState,
  system: SystemId,
  player: PlayerId,
  active: PlayerId,
  decision: DecisionContext,
) {
  const catalog = decision.content.units;
  if (player === active) return opponentWithShips(state, system, active, catalog);
  return shipsOf(state, system, active, catalog).length > 0 ? active : null;
}

/** RR 87.3: Reihum ab dem aktiven Spieler feuern alle Weltraumkanonen in Reichweite. */
function spaceCannonOffense(
  state: GameState,
  tactical: TacticalActionState,
  active: PlayerId,
  decision: DecisionContext,
): Events {
  const { system } = tactical;
  const { dieSides } = state.config.rules;
  const volleys = clockwiseFrom(state, active).flatMap((player): Volley[] => {
    const target = cannonTarget(state, system, player.id, active, decision);
    const shooters = spaceCannonShooters(state, system, player.id, decision.content.units);
    if (target === null || shooters.length === 0) return [];
    return [rollVolley(decision.random, dieSides, shooters, { player: player.id, target })];
  });
  return [
    ...volleys.map((volley) => ({ type: 'SpaceCannonFired', system, volley }) as const),
    { type: 'TacticalStepReached', step: 'spaceCombat' },
  ];
}

function spaceCombatStep(
  state: GameState,
  tactical: TacticalActionState,
  active: PlayerId,
  decision: DecisionContext,
): Events {
  const { system, combat } = tactical;
  const catalog = decision.content.units;
  if (combat === null) return startSpaceCombat(state, system, active, decision);
  if (combat.awaitingRetreat.length > 0) return [];
  if (combat.round > 0 && !combat.rolled) return [rollRound(state, system, combat, decision)];
  const retreat = combat.round > 0 ? retreatEvents(state, system, combat, catalog) : [];
  const after = retreat.reduce(evolveGame, state);
  const ended = combatEnd(after, system, combat, catalog);
  return [...retreat, ...(ended ?? [nextRound(after, system, combat, catalog)])];
}

/** Ohne Wahl (alle Treffer treffen alles) wird automatisch zugewiesen. */
function forcedAssignment(
  state: GameState,
  tactical: TacticalActionState,
  decision: DecisionContext,
): Events {
  const catalog = decision.content.units;
  const forced = tactical.pendingHits.find(({ player, hits }) => {
    const ships = shipsOf(state, tactical.system, player, catalog);
    return hits >= absorbableHits(ships, catalog);
  });
  if (forced === undefined) return [];
  const ships = shipsOf(state, tactical.system, forced.player, catalog);
  const sustained = ships
    .filter((unit) => absorbableHits([unit], catalog) > 1)
    .map((unit) => unit.id);
  const destroyed = ships.map((unit) => unit.id);
  return [
    { type: 'HitsAssigned', player: forced.player, system: tactical.system, sustained, destroyed },
  ];
}

function automaticEvents(state: GameState, decision: DecisionContext): Events {
  const turn = state.actionPhase;
  const tactical = turn?.tactical;
  if (turn?.active == null || tactical == null) return [];
  if (tactical.pendingHits.length > 0) return forcedAssignment(state, tactical, decision);
  if (tactical.step === 'spaceCannon')
    return spaceCannonOffense(state, tactical, turn.active, decision);
  if (tactical.step === 'spaceCombat')
    return spaceCombatStep(state, tactical, turn.active, decision);
  return [];
}

/**
 * Pure Fabrication: führt die Taktikaktion so weit automatisch fort, bis ein
 * Spieler entscheiden muss (Treffer zuweisen, Rückzug) oder der Schritt fertig ist.
 */
export function progressTactical(state: GameState, decision: DecisionContext): Events {
  const next = automaticEvents(state, decision);
  if (next.length === 0) return [];
  return [...next, ...progressTactical(next.reduce(evolveGame, state), decision)];
}

/** Wer in der laufenden Taktikaktion gerade entscheiden muss (auch Nicht-Aktive). */
export function tacticalDecider(state: GameState): PlayerId | null {
  const tactical = state.actionPhase?.tactical;
  if (tactical == null) return null;
  return tactical.pendingHits[0]?.player ?? tactical.combat?.awaitingRetreat[0] ?? null;
}
