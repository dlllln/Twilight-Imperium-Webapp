import type { GameEvent } from '@stellar/domain';
import { type LastEvents, useGameStore } from '../game-store.ts';
import { useDraftStore } from './draft-store.ts';

/*
 * Ein Handel mitten in einer Entscheidung (Handelsmatte während der Produktion) ändert den
 * Spielstand, nicht die Entscheidung: Der Entwurf zieht mit auf den neuen Stand, statt verworfen
 * zu werden. Jeder andere neue Stand (auch Rückgängig) löst ihn wie bisher ab; ob der Entwurf
 * danach noch gilt, prüft das Siegel an der Domain.
 */

/** Ereignisse, die nur Waren zwischen Nachbarn bewegen. */
const TRADE: ReadonlySet<GameEvent['type']> = new Set<GameEvent['type']>([
  'TransactionProposed',
  'TransactionCompleted',
  'TransactionRejected',
]);

const isTrade = (events: readonly GameEvent[]): boolean =>
  events.length > 0 && events.every((event) => TRADE.has(event.type));

/** Schlüssel `route@version`: der Teil vor dem letzten `@` und die Version danach. */
function split(key: string): { readonly route: string; readonly version: string } {
  const at = key.lastIndexOf('@');
  return { route: key.slice(0, at), version: key.slice(at + 1) };
}

/**
 * Der neue Schlüssel eines Entwurfs nach einem Zug; `null`, wenn er nicht mitzieht: Nur ein
 * reiner Handel auf genau dem Stand des Entwurfs trägt ihn auf den neuen Stand.
 */
export function carriedKey(key: string | null, last: LastEvents, version: number): string | null {
  if (key === null || !key.includes('@') || !isTrade(last.events)) return null;
  const { route, version: from } = split(key);
  return from === String(last.before.version) ? `${route}@${String(version)}` : null;
}

/** Zieht den Entwurf nach jedem Handel mit; einmal je Seite eingerichtet. */
export function installDraftCarry(): () => void {
  return useGameStore.subscribe((state, before) => {
    const last = state.lastEvents;
    if (last === null || last === before.lastEvents || state.game === null) return;
    const drafts = useDraftStore.getState();
    const next = carriedKey(drafts.key, last, state.game.version);
    if (next !== null && drafts.draft !== null) drafts.begin(next, drafts.draft);
  });
}
