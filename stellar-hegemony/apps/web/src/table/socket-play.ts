import type { GameState, StrategyChoice, StrategyMechanic } from '@stellar/domain';
import { useGameStore } from '../game-store.ts';
import { orderedCount } from './production-draft.ts';
import { type SecondarySocket, useSecondarySocket } from './secondary-socket.ts';
import { type TableDecision, useTableDecision } from './use-table-decision.ts';

/*
 * Der Sockel als Ziel: Wer der Karte eines anderen folgt, legt den obersten Strategiemarker in
 * den Sockel; kostet sie nichts, genügt ein Antippen des Sockels. Das führt die
 * Sekundärfähigkeit aus: am Tisch gespielte Entscheidungen über ihr Siegel, sobald der Entwurf
 * bereit ist, Karten ohne eigene Wahl (Politik zieht Karten, Handel füllt Waren auf) mit genau
 * der Auswahl, die auch ihr Formular sendet. Alles andere bleibt beim Formular. Solange der
 * Entwurf einer Tischentscheidung (Werft, Forschungsauslage) nicht bereit ist, wartet der Sockel.
 * Eine leere Werft gilt dem Sockel nie als bereit: Wer nichts bauen will, lehnt kostenlos ab,
 * statt einen Strategiemarker für nichts in den Sockel zu legen.
 */

/** Sekundärfähigkeiten ohne eigene Wahl: ihre einzige Auswahl, wie das Formular sie sendet. */
const FIXED: Readonly<Partial<Record<StrategyMechanic, StrategyChoice>>> = {
  politics: { mechanic: 'politics', speaker: null },
  trade: { mechanic: 'trade', freeFor: [] },
};

export interface SocketPlay {
  /** Führt die Sekundärfähigkeit aus; `null`, solange der Sockel nichts auslösen kann. */
  readonly play: (() => void) | null;
  /** Der Sockel nimmt gerade den obersten Strategiemarker an (die Karte kostet einen). */
  readonly takesToken: boolean;
  /** Am Tisch gespielt, bezahlbar, aber der Entwurf ist noch nicht bereit: erst wählen. */
  readonly awaitsDraft: boolean;
}

const IDLE: SocketPlay = { play: null, takesToken: false, awaitsDraft: false };

/** Die feste Auswahl einer Karte ohne Tischentwurf als Befehl. */
function fixedPlay(socket: SecondarySocket, decision: TableDecision): (() => void) | null {
  const choice = FIXED[socket.mechanic];
  const actor = decision.route.actor;
  if (choice === undefined || actor === null) return null;
  return () => {
    useGameStore.getState().send({ type: 'ResolveSecondary', issuedBy: actor, choice });
  };
}

/** Bereit für den Sockel: Der Entwurf ist bereit, und eine Werft hat etwas bestellt. */
function draftReady(decision: TableDecision): boolean {
  const { draft, progress } = decision;
  const emptyYard = draft?.kind === 'production' && orderedCount(draft) === 0;
  return progress?.ready === true && !emptyYard;
}

/** Was der Sockel auslöst: das Siegel einer bereiten Tischentscheidung oder die feste Auswahl. */
function playOf(socket: SecondarySocket, decision: TableDecision): (() => void) | null {
  if (decision.specId === null) return fixedPlay(socket, decision);
  return draftReady(decision) ? decision.confirm : null;
}

/** Reine Regel: Sockel, Entscheidung und was ein Ablegen oder Antippen dort bewirkt. */
export function socketPlayOf(
  socket: SecondarySocket | null,
  decision: TableDecision | null,
): SocketPlay {
  if (socket === null || decision?.route.kind !== 'secondary' || !socket.affordable) return IDLE;
  const play = playOf(socket, decision);
  const awaitsDraft = decision.specId !== null && !draftReady(decision);
  return { play, takesToken: play !== null && socket.cost === 1, awaitsDraft };
}

/** Der Sockel am Bildschirm; in der klassischen Ansicht gibt es keinen. */
export function useSocketPlay(game: GameState | null): SocketPlay {
  const socket = useSecondarySocket(game);
  const decision = useTableDecision(game);
  return socketPlayOf(socket, decision);
}
