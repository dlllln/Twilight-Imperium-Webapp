import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  gameId,
  playerId,
  replay,
  type DomainEvent,
  type ReducerMap,
  setupReducers,
} from '../src/index.ts';
import { config } from './fixtures.ts';

type CounterEvent = (DomainEvent<'Added'> & { readonly amount: number }) | DomainEvent<'Reset'>;

const counterReducers: ReducerMap<number, CounterEvent> = {
  Added: (state, event) => state + event.amount,
  Reset: () => 0,
};

describe('Event-Sourcing-Kern', () => {
  it('wendet Events über den passenden Reducer an', () => {
    expect(applyEvent(counterReducers, 1, { type: 'Added', amount: 2 })).toBe(3);
  });

  it('Replay ist eine Faltung über alle Events', () => {
    const events: CounterEvent[] = [
      { type: 'Added', amount: 5 },
      { type: 'Reset' },
      { type: 'Added', amount: 1 },
    ];
    expect(replay(counterReducers, 0, events)).toBe(1);
  });

  it('GameCreated setzt jeden Vorzustand auf einen frischen Spielaufbau zurück', () => {
    const fresh = setupReducers.GameCreated({ phase: 'action' } as never, {
      type: 'GameCreated',
      gameId: gameId('g'),
      host: playerId('h'),
      config: config(),
    });
    expect(fresh).toMatchObject({ phase: 'setup', round: 0, players: [], version: 1 });
  });
});
