import type { Volley } from '../combat/dice.ts';
import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlanetId, PlayerId, SystemId, UnitId } from '../shared/ids.ts';

/** Welche Einheit auf welchem Planeten landet bzw. welchen Planeten sie bombardiert. */
export interface PlanetAssignment {
  readonly unit: UnitId;
  readonly planet: PlanetId;
}

/**
 * RR 20: Bombardement eines Planeten; Treffer zerstören fremde Bodentruppen.
 * PoK Mech: Bodentruppen mit Schadensresistenz fangen Treffer ab (`sustained`).
 */
export interface BombardmentRolled extends DomainEvent<'BombardmentRolled'> {
  readonly system: SystemId;
  readonly planet: PlanetId;
  readonly volley: Volley;
  readonly sustained: readonly UnitId[];
  readonly destroyed: readonly UnitId[];
}

/** RR 25.2 (Zentrum): Einfluss ausgegeben, der Marker der Thronwelt ist entfernt. */
export interface CenterTokenRemoved extends DomainEvent<'CenterTokenRemoved'> {
  readonly player: PlayerId;
  readonly victoryPoints: number;
}

/** RR 25.2: Bodentruppen landen aus dem Weltraum auf Planeten des aktiven Systems. */
export interface GroundForcesCommitted extends DomainEvent<'GroundForcesCommitted'> {
  readonly player: PlayerId;
  readonly system: SystemId;
  readonly landings: readonly PlanetAssignment[];
}

/** RR 87.7: Weltraumkanonen auf dem Planeten feuern auf gelandete Bodentruppen. */
export interface SpaceCannonDefenseFired extends DomainEvent<'SpaceCannonDefenseFired'> {
  readonly planet: PlanetId;
  readonly volley: Volley;
  readonly sustained: readonly UnitId[];
  readonly destroyed: readonly UnitId[];
}

/** RR 25.4: Eine Runde Bodenkampf; Treffer sind schon den Einheiten zugewiesen. */
export interface GroundCombatRoundRolled extends DomainEvent<'GroundCombatRoundRolled'> {
  readonly planet: PlanetId;
  readonly round: number;
  readonly volleys: readonly Volley[];
  readonly sustained: readonly UnitId[];
  readonly destroyed: readonly UnitId[];
}

export interface GroundCombatEnded extends DomainEvent<'GroundCombatEnded'> {
  readonly planet: PlanetId;
  readonly winner: PlayerId | null;
}

/** RR 25.5: Kontrolle übernommen; fremde Gebäude auf dem Planeten sind zerstört. */
export interface PlanetControlGained extends DomainEvent<'PlanetControlGained'> {
  readonly player: PlayerId;
  readonly planet: PlanetId;
  readonly structuresDestroyed: readonly UnitId[];
}

export type InvasionEvent =
  | BombardmentRolled
  | CenterTokenRemoved
  | GroundForcesCommitted
  | SpaceCannonDefenseFired
  | GroundCombatRoundRolled
  | GroundCombatEnded
  | PlanetControlGained;
