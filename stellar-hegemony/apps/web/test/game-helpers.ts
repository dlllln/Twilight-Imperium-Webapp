import { currentActor, type GameState, type StrategyCardState } from '@stellar/domain';
import { useGameStore } from '../src/game-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { createLocalGame, seatTable } from './local-table.ts';

/** Feste Galaxie, damit Tests nicht von einer zufälligen Karte abhängen. */
const GALAXY_SEED = 4242;

export function threePlayerLayout() {
  useGalaxyStore.getState().setPlayerCount(3);
  useGalaxyStore.getState().generate(GALAXY_SEED);
  return useGalaxyStore.getState().layout;
}

export function started(): GameState {
  const game = createLocalGame(threePlayerLayout(), 3, 7);
  if (!game.ok) throw new Error(game.error.code);
  return game.value;
}

/** Jeder Spieler behält die ersten angebotenen geheimen Aufträge. */
export function keepSecrets(game: GameState): GameState {
  seatTable(game);
  for (const player of game.players) {
    const choice = player.secretChoice;
    if (choice === null) continue;
    const keep = choice.options.slice(0, choice.keep);
    useGameStore.getState().send({ type: 'KeepSecretObjectives', issuedBy: player.id, keep });
  }
  return useGameStore.getState().game as GameState;
}

/** Wählt der Reihe nach die Karten mit der niedrigsten freien Initiative. */
export function pickAll(game: GameState): GameState {
  const store = useGameStore.getState();
  keepSecrets(game);
  while (useGameStore.getState().game?.phase === 'strategy') {
    const state = useGameStore.getState().game as GameState;
    const free = Object.values(state.strategyCards)
      .filter((card) => card.holder === null)
      .sort((a: StrategyCardState, b: StrategyCardState) => a.initiative - b.initiative)[0];
    const actor = currentActor(state);
    if (free === undefined || actor === null || useGameStore.getState().error !== null)
      throw new Error('keine Wahl');
    store.send({ type: 'PickStrategyCard', issuedBy: actor, card: free.id });
  }
  return useGameStore.getState().game as GameState;
}
