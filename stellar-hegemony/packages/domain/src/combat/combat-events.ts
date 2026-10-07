import type { TokenSource } from '../economy/economy-events.ts';
import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { PlayerId, SystemId, UnitId } from '../shared/ids.ts';
import type { TacticalStep } from './combat-state.ts';
import type { Volley } from './dice.ts';

/** Die Taktikaktion geht zum nächsten Schritt über (RR 79). */
export interface TacticalStepReached extends DomainEvent<'TacticalStepReached'> {
  readonly step: TacticalStep;
}

/** RR 87.3: Offensivfeuer der Weltraumkanone; Treffer muss das Ziel zuweisen. */
export interface SpaceCannonFired extends DomainEvent<'SpaceCannonFired'> {
  readonly system: SystemId;
  readonly volley: Volley;
}

/** RR 89.1, RR 66: Treffer werden über Schadensresistenz oder Zerstörung abgewiesen. */
export interface HitsAssigned extends DomainEvent<'HitsAssigned'> {
  readonly player: PlayerId;
  readonly system: SystemId;
  readonly sustained: readonly UnitId[];
  readonly destroyed: readonly UnitId[];
}

export interface SpaceCombatStarted extends DomainEvent<'SpaceCombatStarted'> {
  readonly system: SystemId;
  readonly attacker: PlayerId;
  readonly defender: PlayerId;
}

/** RR 41: Jägerabwehr in der ersten Runde; Jäger sind gleichwertig, daher ohne Wahl. */
export interface AntiFighterBarrageFired extends DomainEvent<'AntiFighterBarrageFired'> {
  readonly system: SystemId;
  readonly volley: Volley;
  readonly destroyed: readonly UnitId[];
}

/** RR 63.5 Schritt 2: Rückzug ankündigen (`to`) oder weiterkämpfen (`null`). */
export interface RetreatDeclared extends DomainEvent<'RetreatDeclared'> {
  readonly player: PlayerId;
  readonly to: SystemId | null;
}

/** RR 63.5 Schritt 3: Kampfwürfe beider Seiten, Angreifer zuerst. */
export interface CombatRoundRolled extends DomainEvent<'CombatRoundRolled'> {
  readonly system: SystemId;
  readonly round: number;
  readonly volleys: readonly Volley[];
}

/** RR 63.7: Schiffe (samt Fracht im Weltraum) ziehen sich zurück; ein Marker kommt ins Ziel. */
export interface ShipsRetreated extends DomainEvent<'ShipsRetreated'> {
  readonly player: PlayerId;
  readonly from: SystemId;
  readonly to: SystemId;
  readonly units: readonly UnitId[];
  readonly token: TokenSource | null;
}

export interface SpaceCombatRoundStarted extends DomainEvent<'SpaceCombatRoundStarted'> {
  readonly round: number;
  readonly awaitingRetreat: readonly PlayerId[];
}

/** RR 63.9/63.10: Ende mit Gewinner oder unentschieden (`null`). */
export interface SpaceCombatEnded extends DomainEvent<'SpaceCombatEnded'> {
  readonly system: SystemId;
  readonly winner: PlayerId | null;
}

export type CombatEvent =
  | TacticalStepReached
  | SpaceCannonFired
  | HitsAssigned
  | SpaceCombatStarted
  | AntiFighterBarrageFired
  | RetreatDeclared
  | CombatRoundRolled
  | ShipsRetreated
  | SpaceCombatRoundStarted
  | SpaceCombatEnded;
