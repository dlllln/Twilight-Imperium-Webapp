import type { GameEvent, GameState, SystemId } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { mapEffects } from '../src/animation/map-effects.ts';
import { MAX_CUES, soundCues, turnCue } from '../src/audio/sound-cues.ts';
import { currentActor } from '@stellar/domain';
import { started } from './game-helpers.ts';

const events = (list: readonly object[]) => list as unknown as readonly GameEvent[];

/** Zwei Systeme mit Planeten und Position aus einer festen Galaxie. */
function twoSystems(state: GameState) {
  const [first, second] = Object.values(state.systems).filter(
    (system) => system.planetIds.length > 0,
  );
  if (first === undefined || second === undefined) throw new Error('zu wenige Systeme');
  return { first, second };
}

describe('Karteneffekte zu einem Zug', () => {
  it('Aktivierung pulsiert, Flug folgt der Route, Gefechte und Eroberung leuchten auf', () => {
    const state = started();
    const { first, second } = twoSystems(state);
    const planet = second.planetIds[0];
    const effects = mapEffects(
      state,
      events([
        { type: 'SystemActivated', player: 'p2', system: second.id },
        {
          type: 'ShipsMoved',
          player: 'p2',
          system: second.id,
          movements: [
            { ship: 'u1', from: first.id, path: [second.id], cargo: [] },
            { ship: 'u2', from: first.id, path: [second.id], cargo: [] },
          ],
        },
        { type: 'UnitsDestroyed', system: second.id, units: ['x'] },
        { type: 'UnitsDestroyed', system: second.id, units: ['y'] },
        { type: 'PlanetControlGained', player: 'p2', planet, structuresDestroyed: [] },
        {
          type: 'UnitsProduced',
          player: 'p2',
          system: first.id,
          space: [],
          planet: null,
          ground: [],
        },
        { type: 'StrategyCardPicked', player: 'p2', card: 'c' },
      ]),
    );
    expect(effects).toEqual([
      { kind: 'pulse', at: second.position, seat: 2 },
      { kind: 'travel', path: [first.position, second.position], seat: 2 },
      { kind: 'blast', at: second.position },
      { kind: 'capture', at: second.position, seat: 2 },
      { kind: 'arrive', at: first.position, seat: 2 },
    ]);
  });

  it('Systeme ohne Position erzeugen keinen Effekt', () => {
    const state = started();
    const missing = 'nirgends' as SystemId;
    expect(
      mapEffects(state, events([{ type: 'UnitsDestroyed', system: missing, units: [] }])),
    ).toEqual([]);
  });
});

describe('Klänge zu einem Zug', () => {
  it('jeder Klang einmal, höchstens vier je Zug', () => {
    const cues = soundCues(
      events([
        { type: 'SystemActivated' },
        { type: 'ShipsMoved' },
        { type: 'CombatRoundRolled' },
        { type: 'CombatRoundRolled' },
        { type: 'UnitsDestroyed' },
        { type: 'PlanetControlGained' },
        { type: 'TacticalActionEnded' },
      ]),
    );
    expect(cues).toEqual(['activate', 'move', 'dice', 'explosion']);
    expect(cues.length).toBe(MAX_CUES);
  });

  it('der Sieg übertönt alle anderen Klänge', () => {
    expect(soundCues(events([{ type: 'ObjectiveScored' }, { type: 'GameWon' }]))).toEqual([
      'victory',
    ]);
  });

  it('online gibt es ein Signal nur, wenn man gerade an die Reihe kommt', () => {
    const state = started();
    const actor = currentActor(state);
    expect(actor).not.toBeNull();
    const other = state.players.find((player) => player.id !== actor)?.id ?? null;
    expect(turnCue(state, state, actor)).toBeNull();
    expect(turnCue(state, state, null)).toBeNull();
    const before = { ...state, phase: 'gameOver' } as GameState;
    expect(turnCue(before, state, actor)).toBe('yourTurn');
    expect(turnCue(before, state, other)).toBeNull();
  });
});
