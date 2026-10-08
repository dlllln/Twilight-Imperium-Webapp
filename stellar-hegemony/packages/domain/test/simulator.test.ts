import { describe, expect, it } from 'vitest';
import {
  botFleet,
  botPlays,
  costOf,
  factionId,
  fightRound,
  type FleetOrder,
  type SimBattle,
  type SimContext,
  simulatorCatalog,
  startBattle,
  summarizeFleet,
  type TacticCard,
  type Unit,
  validateFleet,
} from '../src/index.ts';
import { BLUE, catalog, content, RED, ScriptedRandom, T, unit, units } from './fixtures.ts';

const RULES = { budget: 20, productionLimit: 8 };
const CARDS: readonly TacticCard[] = [
  { id: 'focus', effect: { kind: 'combatBonus', amount: 1 } },
  { id: 'shields', effect: { kind: 'cancelHits', amount: 1 } },
  { id: 'overcharge', effect: { kind: 'extraDice', amount: 2 } },
  { id: 'repair', effect: { kind: 'repair' } },
];

const context = (rolls: readonly number[]): SimContext => ({
  random: new ScriptedRandom(rolls),
  dieSides: 10,
  catalog,
  cards: CARDS,
});

const side = (player: typeof RED, fleet: readonly Unit[]) => ({
  player,
  units: fleet,
  hand: CARDS.map((card) => card.id),
});

const battle = (red: readonly Unit[], blue: readonly Unit[], round = 1): SimBattle => ({
  attacker: side(RED, red),
  defender: side(BLUE, blue),
  round,
  outcome: null,
});

const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? 'ok' : result.error?.code;

describe('Kampfsimulator: Flottenbau', () => {
  it('Jäger kommen paarweise; ein angebrochenes Paar kostet voll (RR 67.2)', () => {
    const fighter = catalog.find(T.fighter);
    expect(fighter && [costOf(fighter, 1), costOf(fighter, 2), costOf(fighter, 3)]).toEqual([
      1, 1, 2,
    ]);
  });

  it('fasst Kosten, Einheiten, Kapazität und Jäger zusammen', () => {
    const order: FleetOrder = { [T.carrier]: 2, [T.fighter]: 5, [T.cruiser]: 1 };
    expect(summarizeFleet(order, catalog, RED)).toEqual({
      cost: 11,
      units: 8,
      capacity: 8,
      fighters: 5,
      warships: 3,
    });
  });

  it('prüft Ressourcen, Produktionslimit, Kapazität, Vorrat und mindestens ein Kriegsschiff', () => {
    const check = (order: FleetOrder) => codeOf(validateFleet(order, catalog, RED, RULES));
    expect(check({ [T.carrier]: 1, [T.fighter]: 4 })).toBe('ok');
    expect(check({ [T.battleship]: 4, [T.carrier]: 2 })).toBe('simulator.budget');
    expect(check({ [T.carrier]: 1, [T.fighter]: 8 })).toBe('simulator.productionLimit');
    expect(check({ [T.cruiser]: 1, [T.fighter]: 1 })).toBe('simulator.capacity');
    expect(check({ [T.carrier]: 5 })).toBe('simulator.unitLimit');
    expect(check({ [T.infantry]: 1, [T.cruiser]: 1 })).toBe('simulator.unitLimit');
    expect(check({})).toBe('simulator.emptyFleet');
  });

  it('ein neuer Kampf gibt beiden Seiten verschiedene Einheiten und alle Karten', () => {
    const fresh = startBattle(
      { player: RED, order: { [T.cruiser]: 2 } },
      { player: BLUE, order: { [T.cruiser]: 2 } },
      CARDS,
    );
    const ids = [...fresh.attacker.units, ...fresh.defender.units].map((u) => u.id);
    expect(new Set(ids).size).toBe(4);
    expect(fresh.defender.hand).toEqual(['focus', 'shields', 'overcharge', 'repair']);
    expect([fresh.round, fresh.outcome]).toEqual([0, null]);
  });

  it('jede Seite kämpft mit den Stärken ihrer Fraktion', () => {
    const sim = simulatorCatalog(content, { [BLUE]: factionId('f-green') });
    expect(sim.find(T.cruiser, BLUE)?.move).toBe(3);
    expect(sim.find(T.cruiser, RED)?.move).toBe(2);
  });
});

describe('Kampfsimulator: Kampfrunde', () => {
  it('RR 41: in Runde 1 schießen Zerstörer zuerst auf Jäger', () => {
    const fresh = {
      ...battle([unit(T.escort)], [unit(T.carrier, BLUE), ...units(2, T.fighter, BLUE)]),
      round: 0,
    };
    const result = fightRound(fresh, {}, context([10, 10, 1]));
    if (!result.ok) throw new Error(result.error.code);
    expect(result.value.report.barrage[0]?.destroyed).toHaveLength(2);
    expect(result.value.battle.defender.units.map((u) => u.type)).toEqual([T.carrier]);
  });

  it('RR 89.1/66: Treffer nutzen zuerst Schadensresistenz, dann fällt das günstigste Schiff', () => {
    const blue = [unit(T.battleship, BLUE), unit(T.cruiser, BLUE)];
    const result = fightRound(battle(units(2, T.cruiser), blue), {}, context([10, 10, 1, 1]));
    if (!result.ok) throw new Error(result.error.code);
    const survivors = result.value.battle.defender.units;
    expect(survivors.map((u) => [u.type, u.damaged])).toEqual([[T.battleship, true]]);
    expect(result.value.battle.round).toBe(2);
  });

  it('Gebündeltes Feuer gibt +1, Notschilde wehren einen Treffer ab', () => {
    const plays = { [RED]: 'focus', [BLUE]: 'shields' };
    const result = fightRound(
      battle([unit(T.cruiser)], units(2, T.cruiser, BLUE)),
      plays,
      context([6, 1]),
    );
    if (!result.ok) throw new Error(result.error.code);
    const { report, battle: after } = result.value;
    expect(report.volleys[0]?.hits).toBe(1);
    expect(report.cancelled).toContainEqual({ player: BLUE, hits: 1 });
    expect(after.defender.units).toHaveLength(2);
    expect(after.attacker.hand).not.toContain('focus');
  });

  it('Überladung: das treffsicherste Schiff würfelt zwei Würfel mehr', () => {
    const red = [unit(T.carrier), unit(T.cruiser)];
    const result = fightRound(
      battle(red, [unit(T.carrier, BLUE)]),
      { [RED]: 'overcharge' },
      context([1]),
    );
    if (!result.ok) throw new Error(result.error.code);
    const dice = result.value.report.volleys[0]?.rolls.map((roll) => roll.results.length);
    expect(dice).toEqual([3, 1]);
  });

  it('Feldreparatur macht beschädigte Schiffe vor den Würfen wieder heil', () => {
    const hurt = unit(T.battleship, RED, true);
    const result = fightRound(
      battle([hurt], [unit(T.carrier, BLUE)]),
      { [RED]: 'repair' },
      context([1]),
    );
    if (!result.ok) throw new Error(result.error.code);
    expect(result.value.report.repaired).toEqual([hurt.id]);
    expect(result.value.battle.attacker.units[0]?.damaged).toBe(false);
  });

  it('der Kampf endet mit Sieger oder, wenn beide Flotten fallen, unentschieden', () => {
    const won = fightRound(
      battle([unit(T.cruiser)], [unit(T.cruiser, BLUE)]),
      {},
      context([10, 1]),
    );
    const draw = fightRound(battle([unit(T.cruiser)], [unit(T.cruiser, BLUE)]), {}, context([10]));
    expect(won.ok && won.value.battle.outcome).toBe(RED);
    expect(draw.ok && draw.value.battle.outcome).toBe('draw');
  });

  it('weist Karten ab, die nicht auf der Hand sind, und Runden nach dem Ende', () => {
    const used = { ...battle([unit(T.cruiser)], [unit(T.cruiser, BLUE)]) };
    const noCard = { ...used, attacker: { ...used.attacker, hand: [] } };
    expect(codeOf(fightRound(noCard, { [RED]: 'focus' }, context([1])))).toBe(
      'simulator.cardNotInHand',
    );
    expect(codeOf(fightRound({ ...used, outcome: RED }, {}, context([1])))).toBe(
      'simulator.finished',
    );
  });
});

describe('Kampfsimulator: KI-Gegner', () => {
  it('baut eine gültige, gemischte Flotte innerhalb der Grenzen', () => {
    const types = [T.carrier, T.cruiser, T.battleship, T.fighter, T.escort];
    const order = botFleet(types, catalog, BLUE, RULES, new ScriptedRandom([0, 3, 1, 2, 4]));
    expect(validateFleet(order, catalog, BLUE, RULES).ok).toBe(true);
    expect(summarizeFleet(order, catalog, BLUE).units).toBeGreaterThan(1);
  });

  it('spielt zuerst die Reparatur, wenn etwas beschädigt ist, sonst Notschilde', () => {
    const hurt = battle([unit(T.cruiser)], [unit(T.battleship, BLUE, true)]);
    const fine = battle([unit(T.cruiser)], [unit(T.battleship, BLUE)]);
    expect(botPlays(hurt, BLUE, CARDS)).toEqual({ [BLUE]: 'repair' });
    expect(botPlays(fine, BLUE, CARDS)).toEqual({ [BLUE]: 'shields' });
    expect(botPlays({ ...fine, defender: { ...fine.defender, hand: [] } }, BLUE, CARDS)).toEqual(
      {},
    );
  });
});
