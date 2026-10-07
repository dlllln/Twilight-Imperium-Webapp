import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { ObjectiveId, PlayerId } from '../shared/ids.ts';
import type { PublicObjectiveSlot, SecretChoice } from './objective-state.ts';

/** RR 12.13 / Aufbau Schritt 12: verdeckte Reihe öffentlicher Aufträge und der Geheimstapel. */
export interface ObjectivesPrepared extends DomainEvent<'ObjectivesPrepared'> {
  readonly public: readonly PublicObjectiveSlot[];
  readonly secretDeck: readonly ObjectiveId[];
}

/** RR 12.14: der Sprecher deckt einen öffentlichen Auftrag auf. */
export interface PublicObjectiveRevealed extends DomainEvent<'PublicObjectiveRevealed'> {
  readonly objective: ObjectiveId;
}

/** Aufbau: Jeder zieht geheime Aufträge und behält einen (RR 12.20). */
export interface SecretObjectivesDealt extends DomainEvent<'SecretObjectivesDealt'> {
  readonly player: PlayerId;
  readonly choice: SecretChoice;
}

/** Die Wahl ist getroffen; nicht behaltene Karten sind zurück im gemischten Stapel. */
export interface SecretObjectivesKept extends DomainEvent<'SecretObjectivesKept'> {
  readonly player: PlayerId;
  readonly kept: readonly ObjectiveId[];
  readonly secretDeck: readonly ObjectiveId[];
}

/**
 * RR 37.2/37.3: oberste Karte des Geheimstapels. Mit `overLimit` muss der Spieler danach
 * einen nicht gewerteten Auftrag zurücklegen (RR 37.4).
 */
export interface SecretObjectiveDrawn extends DomainEvent<'SecretObjectiveDrawn'> {
  readonly player: PlayerId;
  readonly objective: ObjectiveId;
  readonly overLimit: boolean;
}

/** RR 12.18: gewertet; die Siegpunkte stehen im Event. */
export interface ObjectiveScored extends DomainEvent<'ObjectiveScored'> {
  readonly player: PlayerId;
  readonly objective: ObjectiveId;
  readonly points: number;
}

/** Siegpunkte ohne Auftrag, z. B. für die Thronwelt durch das Imperium (RR 37.2). */
export interface VictoryPointsGained extends DomainEvent<'VictoryPointsGained'> {
  readonly player: PlayerId;
  readonly points: number;
}

/** RR 68.7/12.15: Die Partie ist entschieden. */
export interface GameWon extends DomainEvent<'GameWon'> {
  readonly player: PlayerId;
}

export type ObjectiveEvent =
  | ObjectivesPrepared
  | PublicObjectiveRevealed
  | SecretObjectivesDealt
  | SecretObjectivesKept
  | SecretObjectiveDrawn
  | ObjectiveScored
  | VictoryPointsGained
  | GameWon;
