import type { FactionDefinition } from '@stellar/domain';

/*
 * Fraktionswahl vor der Partie als reine Funktionen: Die Menschen wählen der Reihe nach,
 * die KI-Plätze bekommen die übrigen Fraktionen in der Reihenfolge des Inhalts.
 */

/** Fraktionen in Sitzreihenfolge: erst die gewählten, dann die freien. */
export function seatFactions(
  all: readonly FactionDefinition[],
  picks: readonly string[],
): readonly FactionDefinition[] {
  const chosen = picks.flatMap((id) => all.filter((faction) => faction.id === id));
  return [...chosen, ...all.filter((faction) => !picks.includes(faction.id))];
}

/** Erste noch freie Fraktion als Vorschlag für den nächsten Platz. */
export const firstFree = (all: readonly FactionDefinition[], picks: readonly string[]): string =>
  all.find((faction) => !picks.includes(faction.id))?.id ?? '';

/** Welcher Platz (1-basiert) eine Fraktion schon genommen hat. */
export const takenSeats = (picks: readonly string[]): Readonly<Record<string, number>> =>
  Object.fromEntries(picks.map((id, index) => [id, index + 1]));
