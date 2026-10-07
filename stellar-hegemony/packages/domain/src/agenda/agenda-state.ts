import type { AgendaId, PlanetId, PlayerId } from '../shared/ids.ts';
import type { LawEffect } from './agenda-definition.ts';

/** Agendastapel und Ablage (RR 1.5). */
export interface AgendaDeckState {
  readonly deck: readonly AgendaId[];
  readonly discard: readonly AgendaId[];
}

export const NO_AGENDA_DECK: AgendaDeckState = { deck: [], discard: [] };

/** Beschlossenes Gesetz; die Wirkung wird mitgespeichert, damit es sich rückgängig machen lässt. */
export interface EnactedLaw {
  readonly agenda: AgendaId;
  readonly effect: LawEffect;
  /** Besitzer, wenn ein Spieler gewählt wurde (RR 1.4). */
  readonly owner: PlayerId | null;
  readonly planet: PlanetId | null;
}

/** Ein Ergebnis: „for“, „against“ oder die Kennung des gewählten Spielers bzw. Planeten. */
export type OutcomeId = string;

/** Stimmabgabe eines Spielers; `outcome: null` ist eine Enthaltung (RR 2.14). */
export interface Vote {
  readonly player: PlayerId;
  readonly outcome: OutcomeId | null;
  readonly votes: number;
}

export interface AgendaPhaseState {
  /** 1 oder 2: die wievielte Agenda dieser Phase. */
  readonly number: number;
  readonly agenda: AgendaId;
  /** Wer noch abstimmen muss; der Sprecher zuletzt (RR 72.2). */
  readonly awaiting: readonly PlayerId[];
  readonly votes: readonly Vote[];
  /** Bei Gleichstand: zwischen diesen Ergebnissen entscheidet der Sprecher (RR 2.19). */
  readonly tied: readonly OutcomeId[] | null;
}
