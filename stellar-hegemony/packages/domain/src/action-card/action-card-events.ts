import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { ActionCardId, PlayerId } from '../shared/ids.ts';
import type { WindowKind } from './action-card-definition.ts';
import type { ActionTarget, CombatBonus } from './action-card-state.ts';

/** Spielaufbau Schritt 8: der Aktionsstapel ist gemischt. */
export interface ActionDeckPrepared extends DomainEvent<'ActionDeckPrepared'> {
  readonly deck: readonly ActionCardId[];
}

/** Ist der Stapel leer, wird der Ablagestapel gemischt und zum neuen Stapel. */
export interface ActionDeckReshuffled extends DomainEvent<'ActionDeckReshuffled'> {
  readonly deck: readonly ActionCardId[];
}

/** RR 3.3: die obersten Karten des Stapels kommen auf die Hand. */
export interface ActionCardsDrawn extends DomainEvent<'ActionCardsDrawn'> {
  readonly player: PlayerId;
  readonly cards: readonly ActionCardId[];
}

/** RR 3.4: über dem Handkartenlimit legt der Spieler Karten ab. */
export interface ActionCardsDiscarded extends DomainEvent<'ActionCardsDiscarded'> {
  readonly player: PlayerId;
  readonly cards: readonly ActionCardId[];
}

/** Die Karte verlässt die Hand; sie wirkt, sobald niemand sie mehr verhindern will. */
export interface ActionCardPlayed extends DomainEvent<'ActionCardPlayed'> {
  readonly player: PlayerId;
  readonly card: ActionCardId;
  readonly target: ActionTarget;
  readonly awaiting: readonly PlayerId[];
}

/** RR 3.8: die Karte bleibt ohne Wirkung; beide Karten kommen auf den Ablagestapel. */
export interface ActionCardCancelled extends DomainEvent<'ActionCardCancelled'> {
  readonly player: PlayerId;
  readonly card: ActionCardId;
  readonly by: PlayerId;
  readonly with: ActionCardId;
}

/** Ein Spieler verzichtet darauf, die offene Karte zu verhindern. */
export interface CancelDeclined extends DomainEvent<'CancelDeclined'> {
  readonly player: PlayerId;
}

/** Die Karte wirkt (die Wirkungs-Events folgen) und kommt auf den Ablagestapel (RR 3.7). */
export interface ActionCardResolved extends DomainEvent<'ActionCardResolved'> {
  readonly player: PlayerId;
  readonly card: ActionCardId;
}

export interface ReactionWindowOpened extends DomainEvent<'ReactionWindowOpened'> {
  readonly kind: WindowKind;
  /** Schlüssel, damit dasselbe Fenster in dieser Taktikaktion nicht zweimal öffnet. */
  readonly key: string;
  readonly awaiting: readonly PlayerId[];
}

/** Der Spieler spielt in diesem Fenster keine weiteren Karten; nach dem letzten schließt es. */
export interface ReactionPassed extends DomainEvent<'ReactionPassed'> {
  readonly player: PlayerId;
}

export interface CombatBonusGranted extends DomainEvent<'CombatBonusGranted'> {
  readonly bonus: CombatBonus;
}

/** Offene Treffer gegen den Spieler verfallen. */
export interface HitsCancelled extends DomainEvent<'HitsCancelled'> {
  readonly player: PlayerId;
  readonly amount: number;
}

/** Alle beschädigten Einheiten des Spielers sind wieder voll einsatzfähig. */
export interface UnitsRepaired extends DomainEvent<'UnitsRepaired'> {
  readonly player: PlayerId;
}

export type ActionCardEvent =
  | ActionDeckPrepared
  | ActionDeckReshuffled
  | ActionCardsDrawn
  | ActionCardsDiscarded
  | ActionCardPlayed
  | ActionCardCancelled
  | CancelDeclined
  | ActionCardResolved
  | ReactionWindowOpened
  | ReactionPassed
  | CombatBonusGranted
  | HitsCancelled
  | UnitsRepaired;
