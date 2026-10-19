import type { GameState, StrategyChoice, StrategyMechanic } from '@stellar/domain';
import { useGameStore } from '../game-store.ts';
import { type SecondarySocket, useSecondarySocket } from './secondary-socket.ts';
import { type TableDecision, useTableDecision } from './use-table-decision.ts';

/*
 * Der Sockel als Ziel: Wer der Karte eines anderen folgt, legt den obersten Strategiemarker in
 * den Sockel; kostet sie nichts, genügt ein Antippen des Sockels. Das führt die
 * Sekundärfähigkeit aus: am Tisch gespielte Entscheidungen über ihr Siegel, sobald der Entwurf
 * bereit ist, Karten ohne eigene Wahl (Politik zieht Karten, Handel füllt Waren auf) mit genau
 * der Auswahl, die auch ihr Formular sendet. Alles andere bleibt beim Formular.
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
}

const IDLE: SocketPlay = { play: null, takesToken: false };

/** Die feste Auswahl einer Karte ohne Tischentwurf als Befehl. */
function fixedPlay(socket: SecondarySocket, decision: TableDecision): (() => void) | null {
  const choice = FIXED[socket.mechanic];
  const actor = decision.route.actor;
  if (choice === undefined || actor === null) return null;
  return () => {
    useGameStore.getState().send({ type: 'ResolveSecondary', issuedBy: actor, choice });
  };
}

/** Was der Sockel auslöst: das Siegel einer bereiten Tischentscheidung oder die feste Auswahl. */
function playOf(socket: SecondarySocket, decision: TableDecision): (() => void) | null {
  if (decision.specId === null) return fixedPlay(socket, decision);
  return decision.progress?.ready === true ? decision.confirm : null;
}

/** Reine Regel: Sockel, Entscheidung und was ein Ablegen oder Antippen dort bewirkt. */
export function socketPlayOf(
  socket: SecondarySocket | null,
  decision: TableDecision | null,
): SocketPlay {
  if (socket === null || decision?.route.kind !== 'secondary' || !socket.affordable) return IDLE;
  const play = playOf(socket, decision);
  return { play, takesToken: play !== null && socket.cost === 1 };
}

/** Der Sockel am Bildschirm; in der klassischen Ansicht gibt es keinen. */
export function useSocketPlay(game: GameState | null): SocketPlay {
  const socket = useSecondarySocket(game);
  const decision = useTableDecision(game);
  return socketPlayOf(socket, decision);
}
