import type { GameState } from '../game/game-state.ts';
import type { PlayerId, SystemId } from '../shared/ids.ts';
import { canSustainDamage } from '../unit/unit-capabilities.ts';
import type { UnitCatalog } from '../unit/unit-catalog.ts';
import type { Unit } from '../unit/unit.ts';
import { absorbableHits, shipsOf } from './combat-queries.ts';
import { type HitAssignment, suggestHitAssignment } from './hit-assignment.ts';
import { retreatTargets } from './space-combat.ts';
import { tacticalDecider } from './tactical-flow.ts';

/*
 * Reine Abfragen für die Kampfentscheidungen am Tisch (Information Expert): Was gerade
 * entschieden wird, welche Schiffe wie viele Treffer nehmen können und wohin ein Rückzug geht.
 * Sie beantworten genau, was `AssignHits` und `DeclareRetreat` beim Ausführen prüfen.
 */

/** Welche Kampfentscheidung ein Spieler gerade trifft. */
export type CombatChoiceKind = 'hits' | 'retreat';

/** Ein Schiff auf der Kampfmatte: ob es noch einen Treffer mit Schadensresistenz abfängt. */
export interface HitTarget {
  readonly unit: Unit;
  readonly sustainable: boolean;
}

/** Die offene Trefferzuweisung eines Spielers (RR 89.1, RR 66). */
export interface HitChoice {
  readonly system: SystemId;
  /** Gefallene Treffer. */
  readonly hits: number;
  /** So viele Zuweisungen verlangt die Domain: Treffer, höchstens so viele wie abfangbar. */
  readonly required: number;
  readonly units: readonly HitTarget[];
  readonly suggestion: HitAssignment;
}

/** Was der Spieler im Kampf gerade entscheidet; `null`, wenn er nicht an der Reihe ist. */
export function combatChoiceOf(state: GameState, player: PlayerId): CombatChoiceKind | null {
  const tactical = state.actionPhase?.tactical;
  if (tactical == null || tacticalDecider(state) !== player) return null;
  if (tactical.pendingHits.some((entry) => entry.player === player)) return 'hits';
  return tactical.combat?.awaitingRetreat[0] === player ? 'retreat' : null;
}

const sustainableIn = (catalog: UnitCatalog) => (unit: Unit) => {
  const definition = catalog.find(unit.type, unit.owner);
  return !unit.damaged && definition !== undefined && canSustainDamage(definition);
};

/** Die offene Trefferzuweisung samt Vorschlag; `null`, wenn der Spieler keine zuweist. */
export function hitChoice(
  state: GameState,
  player: PlayerId,
  catalog: UnitCatalog,
): HitChoice | null {
  const tactical = state.actionPhase?.tactical;
  const pending = tactical?.pendingHits.find((entry) => entry.player === player);
  if (tactical == null || pending === undefined) return null;
  const ships = shipsOf(state, tactical.system, player, catalog);
  const sustainable = sustainableIn(catalog);
  return {
    system: tactical.system,
    hits: pending.hits,
    required: Math.min(pending.hits, absorbableHits(ships, catalog)),
    units: ships.map((unit) => ({ unit, sustainable: sustainable(unit) })),
    suggestion: suggestHitAssignment(ships, pending.hits, catalog),
  };
}

/** Erlaubte Rückzugsziele; leer, wenn der Spieler gerade nicht über einen Rückzug entscheidet. */
export function retreatChoice(
  state: GameState,
  player: PlayerId,
  catalog: UnitCatalog,
): readonly SystemId[] {
  const system = state.actionPhase?.tactical?.system;
  if (system == null || combatChoiceOf(state, player) !== 'retreat') return [];
  return retreatTargets(state, system, player, catalog);
}
