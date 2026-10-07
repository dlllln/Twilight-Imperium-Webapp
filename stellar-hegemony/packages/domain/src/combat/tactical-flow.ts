import type { GameState } from '../game/game-state.ts';
import { usableCards } from '../action-card/card-timing.ts';
import { windowEvents } from '../action-card/reaction-windows.ts';
import { reachNext } from '../tactical/tactical-steps.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { DecisionContext } from '../eventsourcing/command.ts';
import type { TacticalActionState } from '../phases/turn-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import { absorbableHits, shipsOf } from './combat-queries.ts';
import { rollVolley } from './dice.ts';
import { cannonPlans } from './space-cannon.ts';
import {
  combatEnd,
  nextRound,
  retreatEvents,
  rollRound,
  startSpaceCombat,
} from './space-combat.ts';

type Events = readonly GameEvent[];

/** RR 87.3: Reihum ab dem aktiven Spieler feuern alle Weltraumkanonen in Reichweite. */
function spaceCannonOffense(
  state: GameState,
  tactical: TacticalActionState,
  active: PlayerId,
  decision: DecisionContext,
): Events {
  const { system } = tactical;
  const { dieSides } = state.config.rules;
  const fired = cannonPlans(state, system, active, decision.content.units).map(
    ({ player, target, shooters }) =>
      ({
        type: 'SpaceCannonFired',
        system,
        volley: rollVolley(decision.random, dieSides, shooters, { player, target }),
      }) as const,
  );
  // Der Raumkampf-Schritt entscheidet erst nach der Trefferzuweisung, ob gekämpft wird.
  if (fired.length > 0) return [...fired, { type: 'TacticalStepReached', step: 'spaceCombat' }];
  return [reachNext(state, 'spaceCannon', decision.content)];
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
  const ended = combatEnd(after, system, combat, decision.content);
  return [...retreat, ...(ended ?? [nextRound(after, system, combat, catalog)])];
}

/** Wessen Treffer alle Schiffe erfassen, ohne dass eine Karte sie noch abwenden könnte. */
function forcedHits(state: GameState, tactical: TacticalActionState, decision: DecisionContext) {
  const catalog = decision.content.units;
  return tactical.pendingHits.find(({ player, hits }) => {
    const choice = usableCards(state, player, 'afterHits', decision.content).length > 0;
    const ships = shipsOf(state, tactical.system, player, catalog);
    return !choice && hits >= absorbableHits(ships, catalog);
  });
}

/** Ohne Wahl (alle Treffer treffen alles) wird automatisch zugewiesen. */
function forcedAssignment(
  state: GameState,
  tactical: TacticalActionState,
  decision: DecisionContext,
): Events {
  const catalog = decision.content.units;
  const forced = forcedHits(state, tactical, decision);
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

function stepEvents(
  state: GameState,
  tactical: TacticalActionState,
  active: PlayerId,
  decision: DecisionContext,
): Events {
  if (tactical.step === 'spaceCannon') return spaceCannonOffense(state, tactical, active, decision);
  if (tactical.step === 'spaceCombat') return spaceCombatStep(state, tactical, active, decision);
  return [];
}

/** Ein offenes Zeitfenster oder eine Karte, die noch verhindert werden kann, hält alles an. */
const paused = (state: GameState) => state.reactionWindow !== null || state.pendingPlay !== null;

function automaticEvents(state: GameState, decision: DecisionContext): Events {
  const turn = state.actionPhase;
  const tactical = turn?.tactical;
  if (turn?.active == null || tactical == null || paused(state)) return [];
  if (tactical.pendingHits.length > 0) return forcedAssignment(state, tactical, decision);
  const window = windowEvents(state, decision.content);
  return window.length > 0 ? window : stepEvents(state, tactical, turn.active, decision);
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
