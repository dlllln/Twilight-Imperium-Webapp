import { leaderId, planetId, playerId } from '@stellar/domain';
import { officialLeader } from '@stellar/content';
import { beforeEach, describe, expect, it } from 'vitest';
import { type HandEntry, needsLift } from '../src/hand/hand-model.ts';
import { liftStep, useLiftStore } from '../src/hand/lift-store.ts';
import { content } from '../src/store.ts';

const ME = playerId('red');

const leader = (id: string): HandEntry => ({
  kind: 'leader',
  leader: { id: leaderId(id), kind: 'agent', status: 'ready' },
  player: ME,
  playable: true,
});

describe('Anheben, dann ausspielen', () => {
  beforeEach(() => useLiftStore.getState().lower());

  it('das erste Antippen hebt an, das zweite spielt aus', () => {
    expect(liftStep(null, 'relic-a')).toBe('lift');
    expect(liftStep('relic-a', 'relic-a')).toBe('play');
    expect(liftStep('relic-a', 'relic-b')).toBe('lift');
  });

  it('der Speicher hält genau eine angehobene Karte', () => {
    const store = useLiftStore.getState();
    store.lift('relic-a');
    expect(useLiftStore.getState().lifted).toBe('relic-a');
    store.lift('fragment-b');
    expect(useLiftStore.getState().lifted).toBe('fragment-b');
    store.lower();
    expect(useLiftStore.getState().lifted).toBeNull();
  });

  it('Relikte, Fragmente, legendäre Planeten und eigene Anführer werden angehoben', () => {
    const legendary: HandEntry = {
      kind: 'legendary',
      planet: planetId('p'),
      used: false,
      player: ME,
      playable: true,
    };
    const fragment: HandEntry = {
      kind: 'fragment',
      fragment: 'frontier',
      count: 3,
      purge: null,
      player: ME,
      playable: false,
    };
    expect(needsLift(legendary)).toBe(true);
    expect(needsLift(fragment)).toBe(true);
    expect(needsLift(leader('kein-original'))).toBe(true);
    expect(needsLift({ kind: 'pass', playable: true })).toBe(false);
  });

  it('Aktionskarten und Anführer mit Originalkarte behalten ihren Weg', () => {
    const definition = content.actionCards[0];
    if (definition === undefined) throw new Error('keine Aktionskarte');
    const card = { definition, count: 1, playable: true, targets: {} };
    expect(needsLift({ kind: 'action', card, player: ME, playable: true })).toBe(false);
    const official = content.leaders.find((entry) => officialLeader(entry.id) !== undefined);
    if (official === undefined) throw new Error('kein Originalanführer');
    expect(needsLift(leader(official.id))).toBe(false);
  });
});
