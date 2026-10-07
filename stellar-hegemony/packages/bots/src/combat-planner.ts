import {
  absorbableHits,
  shipsOf,
  suggestHitAssignment,
  type Unit,
  type UnitCatalog,
} from '@stellar/domain';
import { contentOf, issued, type Planner } from './bot-view.ts';

/** Erwartete Treffer je Runde plus Treffer, die die Einheiten aushalten (grobe Kampfkraft). */
export function strength(units: readonly Unit[], catalog: UnitCatalog, dieSides: number): number {
  const expected = units.reduce((sum, unit) => {
    const combat = catalog.find(unit.type, unit.owner)?.combat;
    if (combat === undefined) return sum;
    return sum + (combat.dice * (dieSides + 1 - combat.hitOn)) / dieSides;
  }, 0);
  return expected + absorbableHits(units, catalog);
}

/** RR 89.1: Treffer zuweisen, Schaden zuerst, dann die billigsten Schiffe. */
export const assignHits: Planner = (view) => {
  const tactical = view.state.actionPhase?.tactical;
  const pending = tactical?.pendingHits[0];
  if (tactical == null || pending?.player !== view.player) return [];
  const ships = shipsOf(view.state, tactical.system, view.player, contentOf(view).units);
  const assignment = suggestHitAssignment(ships, pending.hits, contentOf(view).units);
  return [{ type: 'AssignHits', ...issued(view), ...assignment }];
};

/** RR 63.5: Bots kämpfen weiter, statt sich zurückzuziehen. */
export const declineRetreat: Planner = (view) =>
  view.state.actionPhase?.tactical?.combat?.awaitingRetreat[0] === view.player
    ? [{ type: 'DeclareRetreat', ...issued(view), to: null }]
    : [];
