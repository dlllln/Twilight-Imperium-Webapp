import { describe, expect, it } from 'vitest';
import { ART_HEIGHT, ART_WIDTH, lookOf, specksOf, strategyLook } from '../src/hand/card-look.ts';
import { handEntries } from '../src/hand/hand-model.ts';
import { currentActor } from '../src/local-game.ts';
import { keepSecrets, pickAll, started } from './game-helpers.ts';

describe('Aussehen der Handkarten', () => {
  it('RR 83: jede der acht Strategiekarten hat ihr eigenes Motiv', () => {
    const game = keepSecrets(started());
    const actor = currentActor(game);
    const input = { game, actor, viewer: actor, selected: null, choosing: false };
    const looks = handEntries(input).map(lookOf);
    expect(looks).toHaveLength(8);
    expect(new Set(looks).size).toBe(8);
  });

  it('RR 3: Zugkarten unterscheiden sich von Strategiekarten', () => {
    const game = pickAll(started());
    const actor = currentActor(game);
    const input = { game, actor, viewer: null, selected: null, choosing: false };
    const looks = handEntries(input).map(lookOf);
    expect(looks).toContain('tactical');
    expect(looks).toContain('pass');
    expect(strategyLook('warfare')).toBe('warfare');
  });

  it('die Sterne im Bildfenster sind je Karte gleich und liegen im Fenster', () => {
    const specks = specksOf('pick-research');
    expect(specksOf('pick-research')).toEqual(specks);
    expect(specksOf('pick-crown')).not.toEqual(specks);
    for (const speck of specks) {
      expect(speck.x).toBeLessThanOrEqual(ART_WIDTH);
      expect(speck.y).toBeLessThanOrEqual(ART_HEIGHT);
    }
  });
});
