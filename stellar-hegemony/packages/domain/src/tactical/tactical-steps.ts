import { opponentWithShips, shipsOf } from '../combat/combat-queries.ts';
import type { TacticalStepReached } from '../combat/combat-events.ts';
import { TACTICAL_STEPS, type TacticalStep } from '../combat/combat-state.ts';
import { cannonPlans } from '../combat/space-cannon.ts';
import type { GameState } from '../game/game-state.ts';
import {
  bombardablePlanets,
  bombardingShips,
  landingForces,
} from '../invasion/invasion-queries.ts';
import type { ContentPort } from '../ports/content-port.ts';
import { productionSites } from '../production/production-queries.ts';
import type { PlayerId, SystemId } from '../shared/ids.ts';

type Relevance = (
  state: GameState,
  system: SystemId,
  active: PlayerId,
  content: ContentPort,
) => boolean;

/** Ob ein Schritt etwas zu tun hat; sonst wird er übersprungen. */
const RELEVANT: Readonly<Record<TacticalStep, Relevance>> = {
  movement: () => true,
  spaceCannon: (state, system, active, { units }) =>
    cannonPlans(state, system, active, units).length > 0,
  spaceCombat: (state, system, active, { units }) =>
    shipsOf(state, system, active, units).length > 0 &&
    opponentWithShips(state, system, active, units) !== null,
  bombardment: (state, system, active, { units }) =>
    bombardingShips(state, system, active, units).length > 0 &&
    bombardablePlanets(state, system, active, units).length > 0,
  invasion: (state, system, active, { units }) =>
    landingForces(state, system, active, units).length > 0 &&
    (state.systems[system]?.planetIds.length ?? 0) > 0,
  production: (state, system, active, content) =>
    productionSites(state, system, active, content).length > 0,
  done: () => true,
};

/**
 * Nächster Schritt der Taktikaktion nach `after`, der etwas zu tun hat (RR 79).
 * Schritte ohne Wirkung werden übersprungen, damit Spieler nur echte Entscheidungen sehen.
 */
export function reachNext(
  state: GameState,
  after: TacticalStep,
  content: ContentPort,
): TacticalStepReached {
  const turn = state.actionPhase;
  const system = turn?.tactical?.system;
  const active = turn?.active;
  const later = TACTICAL_STEPS.slice(TACTICAL_STEPS.indexOf(after) + 1);
  const step =
    system === undefined || active == null
      ? 'done'
      : (later.find((candidate) => RELEVANT[candidate](state, system, active, content)) ?? 'done');
  return { type: 'TacticalStepReached', step };
}
