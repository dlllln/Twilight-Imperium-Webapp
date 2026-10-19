import { freeSecondary } from '../faction/faction-ability.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { StrategyCardDefinition } from '../strategy/strategy-card.ts';

/**
 * Was die Sekundärfähigkeit einer Strategiekarte den Spieler kostet (RR 34.4, Fraktionsregeln):
 * einen Strategiemarker, außer die Karte ist kostenlos (Führung), der Spieler hält einen
 * Freibrief des Handels oder seine Fraktion nutzt die Fähigkeit ohne Marker.
 */
export function secondaryTokenCost(
  state: GameState,
  player: PlayerId,
  card: StrategyCardDefinition,
): 0 | 1 {
  if (!card.secondaryCostsStrategyToken) return 0;
  if (state.actionPhase?.secondary?.free.includes(player) === true) return 0;
  return freeSecondary(state, player, card.mechanic) ? 0 : 1;
}
