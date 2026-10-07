import { excessActionCards, reactionActor } from '@stellar/domain';
import { issued, me, type Planner } from './bot-view.ts';

/** RR 12.20: die ersten angebotenen geheimen Aufträge behalten. */
export const keepSecrets: Planner = (view) => {
  const choice = me(view).secretChoice;
  if (choice === null) return [];
  const keep = choice.options.slice(0, choice.keep);
  return [{ type: 'KeepSecretObjectives', ...issued(view), keep }];
};

/** Zeitfenster und Verhindern: Bots spielen hier keine Karte. */
export const passReaction: Planner = (view) =>
  reactionActor(view.state) === view.player ? [{ type: 'PassReaction', ...issued(view) }] : [];

/** RR 3.4: über dem Handkartenlimit die ältesten Karten ablegen. */
export const discardExcess: Planner = (view) => {
  const excess = excessActionCards(view.state, view.player);
  if (excess === 0) return [];
  const cards = me(view).actionCards.slice(0, excess);
  return [{ type: 'DiscardActionCards', ...issued(view), cards }];
};
