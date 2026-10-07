import type { DecisionContext } from '../eventsourcing/command.ts';
import { shuffle } from '../ports/random-port.ts';
import type { ActionDeckPrepared } from './action-card-events.ts';

/** Spielaufbau Schritt 8 (RR 12.8): alle Exemplare aller Aktionskarten gemischt. */
export function actionDeckEvent(context: DecisionContext): ActionDeckPrepared {
  const copies = context.content.actionCards.flatMap((card) =>
    Array.from({ length: card.copies }, () => card.id),
  );
  return { type: 'ActionDeckPrepared', deck: shuffle(context.random, copies) };
}
