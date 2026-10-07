import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { rollDice, rollDie, shuffle } from '../src/index.ts';
import { ScriptedRandom } from './fixtures.ts';

describe('Zufall über RandomPort (deterministische Domain)', () => {
  it('W10-Würfe liegen zwischen 1 und 10', () => {
    const random = new ScriptedRandom([0, 5, 12]);
    expect(rollDice(random, 10, 3)).toEqual([1, 5, 10]);
    expect(rollDie(new ScriptedRandom([7]), 10)).toBe(7);
  });

  it('Mischen ist eine Permutation und verändert die Eingabe nicht', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()),
        fc.array(fc.nat(20), { minLength: 1 }),
        (items, script) => {
          const original = [...items];
          const shuffled = shuffle(new ScriptedRandom(script), items);
          return (
            JSON.stringify([...shuffled].sort()) === JSON.stringify([...items].sort()) &&
            JSON.stringify(items) === JSON.stringify(original)
          );
        },
      ),
    );
  });
});
