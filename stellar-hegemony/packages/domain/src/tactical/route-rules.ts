import type { SystemState } from '../galaxy/system-state.ts';
import type { RuleNumbers } from '../game/rule-numbers.ts';
import type { PlayerId } from '../shared/ids.ts';
import { countsTowardFleetLimit } from '../unit/unit-capabilities.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { UnitDefinition } from '../unit/unit-definition.ts';

/**
 * Pure Fabrication: Regeln dafür, welche Systeme ein Schiff auf seiner Route
 * betreten darf (RR 11 Asteroidenfeld, RR 57 Nebel, RR 77 Supernova, RR 15.5).
 */
export function canEnter(
  system: SystemState,
  player: PlayerId,
  isDestination: boolean,
  catalog: UnitCatalog,
): boolean {
  if (system.anomaly === 'asteroidField' || system.anomaly === 'supernova') return false;
  if (isDestination) return true;
  return system.anomaly !== 'nebula' && !hasForeignBlockers(system, player, catalog);
}

/** RR 15.5: Nicht-Jäger-Schiffe anderer Spieler versperren den Durchflug. */
function hasForeignBlockers(system: SystemState, player: PlayerId, catalog: UnitCatalog): boolean {
  return system.spaceUnits.some((unit) => {
    const definition = catalog.find(unit.type);
    return unit.owner !== player && definition !== undefined && countsTowardFleetLimit(definition);
  });
}

/** RR 57.2: Wer im Nebel startet, hat Bewegungswert 1 (Wert aus den Regelzahlen). */
export const baseMove = (ship: UnitDefinition, origin: SystemState, rules: RuleNumbers): number =>
  origin.anomaly === 'nebula' ? rules.nebulaMoveValue : (ship.move ?? 0);

export const isGravityRift = (system: SystemState): boolean => system.anomaly === 'gravityRift';
