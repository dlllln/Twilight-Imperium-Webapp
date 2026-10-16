import {
  excessActionCards,
  findPlayer,
  type GameState,
  type PlayerId,
  reactionActor,
} from '@stellar/domain';

/*
 * Wächter des eigenen Zugs (reine Funktionen). Sie liegen getrennt vom Handmodell, damit
 * Tisch, Karte und Hand sie teilen können, ohne einander zu importieren.
 */

/** Geheimauftrag wählen, auf eine Karte reagieren, über dem Limit ablegen gehen vor. */
export const interrupted = (game: GameState, player: PlayerId): boolean =>
  findPlayer(game, player)?.secretChoice != null ||
  reactionActor(game) === player ||
  excessActionCards(game, player) > 0;

/** Kein Schritt einer taktischen Aktion, keine Sekundärfähigkeit und kein Tausch offen. */
export const freeTurn = (game: GameState): boolean => {
  const phase = game.actionPhase;
  return phase?.tactical == null && phase?.secondary == null && phase?.transaction == null;
};
