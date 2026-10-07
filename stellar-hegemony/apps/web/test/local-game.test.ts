import { describe, expect, it } from 'vitest';
import { useGameStore } from '../src/game-store.ts';
import { currentActor, seatPlayerId } from '../src/local-game.ts';
import { pickAll, started, threePlayerLayout } from './game-helpers.ts';

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
        secondary: { card: 'vanguard' as never, awaiting: [seatPlayerId(2)], free: [] },
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
