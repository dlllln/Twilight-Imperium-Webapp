import type { GameState, StrategyCardState } from '@stellar/domain';
import { useGameStore } from '../src/game-store.ts';
import { createLocalGame, currentActor } from '../src/local-game.ts';
import { useGalaxyStore } from '../src/store.ts';

export function threePlayerLayout() {
  useGalaxyStore.getState().setPlayerCount(3);
  return useGalaxyStore.getState().layout;
}

export function started(): GameState {
  const game = createLocalGame(threePlayerLayout(), 3, 7);
  if (!game.ok) throw new Error(game.error.code);
  return game.value;
}

/** Wählt der Reihe nach die Karten mit der niedrigsten freien Initiative. */
export function pickAll(game: GameState): GameState {
  const store = useGameStore.getState();
  useGameStore.setState({ game, seed: 7, error: null });
  while (useGameStore.getState().game?.phase === 'strategy') {
    const state = useGameStore.getState().game as GameState;
    const free = Object.values(state.strategyCards)
      .filter((card) => card.holder === null)
      .sort((a: StrategyCardState, b: StrategyCardState) => a.initiative - b.initiative)[0];
    const actor = currentActor(state);
    if (free === undefined || actor === null) throw new Error('keine Wahl');
    store.send({ type: 'PickStrategyCard', issuedBy: actor, card: free.id });
  }
  return useGameStore.getState().game as GameState;
}
