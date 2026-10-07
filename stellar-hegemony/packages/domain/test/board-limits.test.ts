import { describe, expect, it } from 'vitest';
import { type GameState, planetId } from '../src/index.ts';
import { RED, T, unit, units } from './fixtures.ts';
import { activate, board, S } from './board.ts';
import { step } from './game-flow.ts';

const PLANET_A = planetId('p-a');

describe('Grenzen zu jedem Zeitpunkt (RR 28.3, RR 43.3)', () => {
  it('RR 43.3: geht der Hangar verloren, werden die Jäger außerhalb des aktiven Systems zerstört', () => {
    const fighters = units(2, T.fighter);
    const docked = board(
      { id: 'a', q: 0, units: fighters, planet: [unit(T.dock)] },
      { id: 'b', q: 1 },
    );
    const lost: GameState = {
      ...docked,
      planets: {
        ...docked.planets,
        [PLANET_A]: { ...(docked.planets[PLANET_A] as GameState['planets'][string]), units: [] },
      },
    };
    expect(step(docked, activate('b')).state.systems.a?.spaceUnits).toEqual(fighters);
    const { state, events } = step(lost, activate('b'));
    expect(events).toContainEqual({
      type: 'UnitsDestroyed',
      system: S('a'),
      units: fighters.map((fighter) => fighter.id),
    });
    expect(state.systems.a?.spaceUnits).toEqual([]);
  });

  it('RR 43.4: im aktiven System entscheidet erst Bewegung oder Kampfende über Fracht', () => {
    const fighters = units(2, T.fighter);
    const state = board({ id: 'a', q: 0 }, { id: 'b', q: 1, units: fighters });
    const { state: after } = step(state, activate('b', RED));
    expect(after.systems.b?.spaceUnits).toEqual(fighters);
  });
});
