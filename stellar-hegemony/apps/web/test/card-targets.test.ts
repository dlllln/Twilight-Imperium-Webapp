import { planetId, playerId, systemId, type TargetOptions } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import {
  cardDropTarget,
  cardTargetKeys,
  hasTargets,
  initialTarget,
  playsByDrop,
  targetComplete,
} from '../src/table/card-targets.ts';
import {
  playerTarget,
  poolTarget,
  siteTarget,
  systemTarget,
  unitTarget,
} from '../src/table/target-ref.ts';

const A = planetId('alpha');
const B = planetId('beta');
const S = systemId('18');
const T = systemId('19');
const P = playerId('blue');

const ALL: TargetOptions = {
  planets: { options: [A, B], max: 1 },
  systems: [S, T],
  players: [P],
  pool: true,
};

describe('Ziele einer Aktionskarte am Tisch', () => {
  it('die Vorauswahl nimmt je Feld die erste Möglichkeit', () => {
    expect(initialTarget(ALL)).toEqual({ planets: [A], system: S, player: P, pool: 'tactic' });
    expect(initialTarget({})).toEqual({});
    expect(hasTargets({})).toBe(false);
    expect(hasTargets({ systems: [S] })).toBe(true);
    expect(targetComplete(ALL, { planets: [] })).toBe(false);
    expect(targetComplete({ systems: [S] }, {})).toBe(true);
  });

  it('jede angebotene Möglichkeit wird zu einem Tischziel', () => {
    expect([...cardTargetKeys(ALL)]).toEqual([
      'site:alpha',
      'site:beta',
      'system:18',
      'system:19',
      'player:blue',
      'pool:tactic',
      'pool:fleet',
      'pool:strategy',
    ]);
    expect(cardTargetKeys({}).size).toBe(0);
  });

  it('das Ablegen ersetzt in der Vorauswahl genau das getroffene Feld', () => {
    expect(cardDropTarget(ALL, siteTarget(B))).toEqual({
      planets: [B],
      system: S,
      player: P,
      pool: 'tactic',
    });
    expect(cardDropTarget(ALL, systemTarget(T))?.system).toBe(T);
    expect(cardDropTarget(ALL, poolTarget('fleet'))?.pool).toBe('fleet');
    expect(cardDropTarget({ players: [P] }, playerTarget(P))).toEqual({ player: P });
  });

  it('nicht angebotene Ziele nimmt die Karte nicht an', () => {
    expect(cardDropTarget({ systems: [S] }, systemTarget('99'))).toBeNull();
    expect(cardDropTarget({ systems: [S] }, siteTarget(A))).toBeNull();
    expect(cardDropTarget(ALL, poolTarget('loose'))).toBeNull();
    expect(cardDropTarget(ALL, unitTarget('u1'))).toBeNull();
  });

  it('eine Karte für bis zu zwei Planeten lässt sich nicht mit einem Ablegen ausspielen', () => {
    const two: TargetOptions = { planets: { options: [A, B], max: 2 } };
    expect(playsByDrop(two)).toBe(false);
    expect(cardDropTarget(two, siteTarget(A))).toBeNull();
    expect(playsByDrop({ planets: { options: [A, B], max: 1 } })).toBe(true);
    expect(playsByDrop({ systems: [S] })).toBe(true);
    expect(playsByDrop({})).toBe(false);
  });
});
