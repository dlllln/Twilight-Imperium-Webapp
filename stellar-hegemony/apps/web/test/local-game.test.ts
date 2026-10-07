import { describe, expect, it } from 'vitest';
import type { GameState, StrategyCardState } from '@stellar/domain';
import { useGameStore } from '../src/game-store.ts';
import { createLocalGame, currentActor, seatPlayerId } from '../src/local-game.ts';
import { useGalaxyStore } from '../src/store.ts';

function threePlayerLayout() {
  useGalaxyStore.getState().setPlayerCount(3);
  return useGalaxyStore.getState().layout;
}

function started(): GameState {
  const game = createLocalGame(threePlayerLayout(), 3, 7);
  if (!game.ok) throw new Error(game.error.code);
  return game.value;
}

/** Wählt der Reihe nach die Karten mit der niedrigsten freien Initiative. */
function pickAll(game: GameState): GameState {
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

describe('Lokale Hot-Seat-Partie', () => {
  it('startet mit allen Plätzen in der Strategiephase', () => {
    const game = started();
    expect(game.players.map((player) => player.id)).toEqual([0, 1, 2].map(seatPlayerId));
    expect(game.phase).toBe('strategy');
    expect(game.pickQueue).toHaveLength(6);
    expect(currentActor(game)).toBe(game.speaker);
  });

  it('nach der Kartenwahl entscheidet der aktive Spieler, im Sekundärfenster der Nächste', () => {
    const game = pickAll(started());
    expect(game.phase).toBe('action');
    expect(currentActor(game)).toBe(game.actionPhase?.active);
    const window = {
      ...game,
      actionPhase: game.actionPhase && {
        ...game.actionPhase,
        secondary: { card: 'vanguard' as never, awaiting: [seatPlayerId(2)] },
      },
    };
    expect(currentActor(window)).toBe(seatPlayerId(2));
    expect(currentActor({ ...game, phase: 'status', actionPhase: null })).toBeNull();
  });

  it('der Store meldet Regelverstöße und kann die Partie verlassen', () => {
    const store = useGameStore.getState();
    store.start(threePlayerLayout(), 3, 3);
    expect(useGameStore.getState().game?.phase).toBe('strategy');
    expect(store.send({ type: 'Pass', issuedBy: seatPlayerId(0) })).toBe(false);
    expect(useGameStore.getState().error?.code).toBe('phase.commandNotAllowed');
    store.leave();
    expect(useGameStore.getState().game).toBeNull();
    expect(store.send({ type: 'Pass', issuedBy: seatPlayerId(0) })).toBe(false);
  });

  it('ohne passende Vorlage bleibt die Partie aus und der Fehler wird gezeigt', () => {
    useGameStore.getState().start([], 3, 1);
    expect(useGameStore.getState().game).toBeNull();
    expect(useGameStore.getState().error).not.toBeNull();
  });
});
