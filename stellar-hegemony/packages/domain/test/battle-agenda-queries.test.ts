import { describe, expect, it } from 'vitest';
import {
  assignHitsHandler,
  combatChoiceOf,
  type EnactedLaw,
  type GameState,
  hitChoice,
  planetId,
  type PlayerId,
  retreatChoice,
  tacticalDecider,
  type Unit,
  votesFrom,
} from '../src/index.ts';
import { activate, board, moves, order, S, type Spec } from './board.ts';
import {
  AG,
  BLUE,
  catalog,
  content,
  contextWith,
  RED,
  ScriptedRandom,
  T,
  unit,
  units,
} from './fixtures.ts';
import { GREEN, run, statusPhaseGame, step } from './game-flow.ts';

/*
 * Reine Abfragen für Kampfmatte und Agendatisch: Was gerade entschieden wird, wie viele Treffer
 * welche Schiffe nehmen, wohin ein Rückzug geht und wie viele Stimmen eine Abgabe bringt.
 */

const HIT = new ScriptedRandom([10]);
const MISS = new ScriptedRandom([1]);

/** Rot fliegt die Schiffe aus `a` nach `b` (aktiviert); dort steht Blau. */
function attack(specs: readonly Spec[], ships: readonly Unit[], random = HIT): GameState {
  const activated = run(board(...specs), [activate('b')]);
  const orders = ships.map((ship) => order(ship, ['b']));
  return step(activated, moves(...orders), contextWith(random)).state;
}

const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? 'ok' : result.error?.code;

describe('Kampfmatte: Treffer zuweisen', () => {
  const fleet = units(2, T.battleship);
  const state = attack(
    [
      { id: 'a', q: 0, units: fleet },
      { id: 'b', q: 1, units: units(5, T.cruiser, BLUE) },
    ],
    fleet,
  );

  it('nennt Treffer, verlangte Zuweisungen, Schadensresistenz je Schiff und den Vorschlag', () => {
    const choice = hitChoice(state, RED, catalog);
    expect(choice).toMatchObject({ system: S('b'), hits: 3, required: 3 });
    expect(choice?.units.map((target) => target.sustainable)).toEqual([true, true]);
    expect(choice?.suggestion.sustained).toHaveLength(2);
    expect(choice?.suggestion.destroyed).toHaveLength(1);
  });

  it('mehr Treffer als Schiffe: eine Einheit fängt Schaden ab und wird dennoch zerstört', () => {
    const [first, second] = fleet;
    if (first === undefined || second === undefined) throw new Error('Schiffe fehlen');
    const command = {
      type: 'AssignHits',
      issuedBy: RED,
      sustained: [first.id, second.id],
      destroyed: [second.id],
    } as const;
    expect(codeOf(assignHitsHandler.decide(state, command, contextWith()))).toBe('ok');
  });

  it('wer an der Reihe ist, entscheidet über Treffer; die anderen warten', () => {
    const decider = tacticalDecider(state) as PlayerId;
    const other = decider === RED ? BLUE : RED;
    expect(combatChoiceOf(state, decider)).toBe('hits');
    expect(combatChoiceOf(state, other)).toBeNull();
    expect(hitChoice(state, GREEN, catalog)).toBeNull();
  });

  it('ohne laufende Taktikaktion gibt es weder Treffer noch Rückzug', () => {
    const calm = board({ id: 'a', q: 0 });
    expect(combatChoiceOf(calm, RED)).toBeNull();
    expect(hitChoice(calm, RED, catalog)).toBeNull();
    expect(retreatChoice(calm, RED, catalog)).toEqual([]);
  });
});

describe('Kampfmatte: Rückzug', () => {
  const red = unit(T.cruiser);
  const blue = unit(T.cruiser, BLUE);
  const state = attack(
    [
      { id: 'a', q: 0, units: [red], planet: [], planetController: RED },
      { id: 'b', q: 1, units: [blue] },
      { id: 'c', q: 2, planet: [], planetController: BLUE },
    ],
    [red],
    MISS,
  );

  it('der Verteidiger entscheidet zuerst und sieht genau seine Ziele', () => {
    expect(combatChoiceOf(state, BLUE)).toBe('retreat');
    expect(retreatChoice(state, BLUE, catalog)).toEqual([S('c')]);
    expect(retreatChoice(state, RED, catalog)).toEqual([]);
  });

  it('nach dem Verteidiger entscheidet der Angreifer mit seinem eigenen Ziel', () => {
    const stays = run(state, [{ type: 'DeclareRetreat', issuedBy: BLUE, to: null }]);
    expect(combatChoiceOf(stays, RED)).toBe('retreat');
    expect(retreatChoice(stays, RED, catalog)).toEqual([S('a')]);
  });
});

describe('Agendatisch: Stimmen einer Abgabe', () => {
  const prime = (player: PlayerId) => planetId(`${player}-prime`);
  const state = statusPhaseGame();

  it('Einfluss der gewählten bereiten Planeten plus Stimmen aus Gesetzen', () => {
    expect(votesFrom(state, BLUE, [prime(BLUE)], content)).toBe(2);
    expect(votesFrom(state, BLUE, [], content)).toBe(0);
    const effect = { kind: 'ownerVotes', amount: 2 } as const;
    const law: EnactedLaw = { agenda: AG('seat'), effect, owner: BLUE, planet: null };
    expect(votesFrom({ ...state, laws: [law] }, BLUE, [prime(BLUE)], content)).toBe(4);
  });

  it('fremde und erschöpfte Planeten zählen nicht', () => {
    expect(votesFrom(state, BLUE, [prime(RED)], content)).toBe(0);
    const planet = state.planets[prime(BLUE)] as GameState['planets'][string];
    const tired = {
      ...state,
      planets: { ...state.planets, [planet.id]: { ...planet, exhausted: true } },
    };
    expect(votesFrom(tired, BLUE, [prime(BLUE)], content)).toBe(0);
  });
});
