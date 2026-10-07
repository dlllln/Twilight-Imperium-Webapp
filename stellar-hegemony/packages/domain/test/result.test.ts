import { describe, expect, it } from 'vitest';
import { andThen, combine, ensure, err, foldResult, map, ok } from '../src/index.ts';

describe('Result', () => {
  it('map transformiert nur Erfolge', () => {
    expect(map(ok(2), (value) => value * 3)).toEqual(ok(6));
    expect(map(err('x'), (value: number) => value * 3)).toEqual(err('x'));
  });

  it('andThen verkettet und bricht bei Fehlern ab', () => {
    expect(andThen(ok(2), (value) => ok(value + 1))).toEqual(ok(3));
    expect(andThen(err('nein'), () => ok(1))).toEqual(err('nein'));
  });

  it('combine liefert alle Werte oder den ersten Fehler', () => {
    expect(combine([ok(1), ok(2)])).toEqual(ok([1, 2]));
    expect(combine([ok(1), err('a'), err('b')])).toEqual(err('a'));
  });

  it('foldResult akkumuliert und stoppt beim ersten Fehler', () => {
    const step = (sum: number, item: number) =>
      item < 0 ? err(`negativ: ${item}`) : ok(sum + item);
    expect(foldResult([1, 2, 3], 0, step)).toEqual(ok(6));
    expect(foldResult([1, -2, -3], 0, step)).toEqual(err('negativ: -2'));
  });

  it('ensure prüft eine Bedingung', () => {
    expect(ensure(true, () => 'f')).toEqual(ok(true));
    expect(ensure(false, () => 'f')).toEqual(err('f'));
  });
});
