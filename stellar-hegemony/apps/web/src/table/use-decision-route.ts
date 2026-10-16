import { currentActor, type GameState, type PlayerId, type StrategyCardId } from '@stellar/domain';
import { useGameStore } from '../game-store.ts';
import { useHandStore } from '../hand/hand-store.ts';
import { decisionOf, type DecisionRoute } from './decision-route.ts';

/** Die aus der Hand gewählte strategische Aktion, falls sie diesem Spieler gehört. */
export function useChosenCard(actor: PlayerId | null): StrategyCardId | null {
  const chosen = useHandStore((state) => state.chosen);
  return chosen !== null && chosen.player === actor ? chosen.card : null;
}

/**
 * Die offene Entscheidung am Bildschirm. Entscheidet der eigene Platz, ist er der Handelnde
 * (wie `useHumanActor`); sonst wartet man auf den, der gerade dran ist (wie `useOthersTurn`).
 */
export function useDecisionRoute(game: GameState | null): DecisionRoute | null {
  const me = useGameStore((state) => state.me);
  const current = game === null ? null : currentActor(game);
  const actor = me !== null && current === me ? me : null;
  const waitingOn = current === me ? null : current;
  const chosen = useChosenCard(actor);
  return game === null ? null : decisionOf({ game, actor, waitingOn, chosen });
}
