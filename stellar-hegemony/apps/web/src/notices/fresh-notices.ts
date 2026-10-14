import type { PlayerId } from '@stellar/domain';
import type { HistoryEntry } from '../history/turn-history.ts';

/*
 * Benachrichtigungen unten rechts (reine Funktionen): Was die anderen gerade getan haben, ploppt
 * kurz auf und verschwindet wieder. Eigene Züge kennt man schon, sie erscheinen nur im Verlauf.
 */

/** So viele Meldungen stehen höchstens gleichzeitig da. */
export const NOTICE_LIMIT = 3;
/** So lange bleibt eine Meldung stehen. */
export const NOTICE_MS = 6000;

const byOthers = (entry: HistoryEntry, me: PlayerId | null): boolean =>
  !('player' in entry.line) || entry.line.player !== me;

/** Neue Zeilen nach `after`, die andere betreffen. */
export function freshEntries(
  history: readonly HistoryEntry[],
  after: number,
  me: PlayerId | null,
): readonly HistoryEntry[] {
  return history.filter((entry) => entry.id > after && byOthers(entry, me));
}

/** Die angezeigten Meldungen plus die neuen, die ältesten fallen heraus. */
export const withFresh = (
  shown: readonly HistoryEntry[],
  fresh: readonly HistoryEntry[],
): readonly HistoryEntry[] => [...shown, ...fresh].slice(-NOTICE_LIMIT);
