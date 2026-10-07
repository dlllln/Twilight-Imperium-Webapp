import { describe, expect, it } from 'vitest';
import {
  absorbableHits,
  assignHitsHandler,
  declareRetreatHandler,
  type GameEvent,
  type GameState,
  locateUnit,
  type PlayerId,
  retreatTargets,
  suggestHitAssignment,
  tacticalDecider,
  type Unit,
  validateHitAssignment,
} from '../src/index.ts';
import { activate, board, moves, order, S, type Spec } from './board.ts';
import { BLUE, catalog, contextWith, RED, ScriptedRandom, T, unit, units } from './fixtures.ts';
import { GREEN, run, step } from './game-flow.ts';

const HIT = new ScriptedRandom([10]);
const MISS = new ScriptedRandom([1]);

const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? 'ok' : result.error?.code;

/** Rot fliegt die Schiffe aus `a` nach `b` (aktiviert), das erste Schiff trägt `cargo`. */
function attack(
  specs: readonly Spec[],
  ships: readonly Unit[],
  random = HIT,
  cargo: readonly Unit[] = [],
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const activated = run(board(...specs), [activate('b')]);
  const orders = ships.map((ship, index) => order(ship, ['b'], index === 0 ? cargo : []));
  return step(activated, moves(...orders), contextWith(random));
}

const assign = (
  issuedBy: PlayerId,
  sustained: readonly Unit[] = [],
  destroyed: readonly Unit[] = [],
) =>
  ({
    type: 'AssignHits',
    issuedBy,
    sustained: sustained.map((u) => u.id),
    destroyed: destroyed.map((u) => u.id),
  }) as const;

const retreat = (issuedBy: PlayerId, to: string | null) =>
  ({ type: 'DeclareRetreat', issuedBy, to: to === null ? null : S(to) }) as const;

describe('Weltraumkanone in der Offensive (RR 87.3)', () => {
  it('RR 87.3: eine feindliche Batterie im aktiven System beschießt die ankommenden Schiffe', () => {
    const cruisers = units(2, T.cruiser);
    const battery = unit(T.battery, BLUE);
    const { state, events } = attack(
      [
        { id: 'a', q: 0, units: cruisers },
        { id: 'b', q: 1, planet: [battery], planetController: BLUE },
      ],
      cruisers,
    );
    const fired = events.find((event) => event.type === 'SpaceCannonFired');
    expect(fired).toMatchObject({ volley: { player: BLUE, target: RED, hits: 1 } });
    expect(state.actionPhase?.tactical).toMatchObject({
      step: 'spaceCombat',
      pendingHits: [{ player: RED, hits: 1 }],
    });
    expect(tacticalDecider(state)).toBe(RED);
  });

  it('RR 87.3/89.1: nach der Trefferzuweisung geht es ohne Gegner direkt zum Ende', () => {
    const cruisers = units(2, T.cruiser);
    const { state } = attack(
      [
        { id: 'a', q: 0, units: cruisers },
        { id: 'b', q: 1, planet: [unit(T.battery, BLUE)], planetController: BLUE },
      ],
      cruisers,
    );
    const [lost, kept] = cruisers as [Unit, Unit];
    const after = step(state, assign(RED, [], [lost]));
    expect(locateUnit(after.state, lost.id)).toBeUndefined();
    expect(locateUnit(after.state, kept.id)?.system).toBe(S('b'));
    expect(after.state.actionPhase?.tactical).toMatchObject({ step: 'done', pendingHits: [] });
    expect(tacticalDecider(after.state)).toBeNull();
  });

  it('RR 87.3: Reichweite 1 erfasst Nachbarsysteme, Reichweite 0 nicht', () => {
    const cruisers = units(3, T.cruiser);
    const { events } = attack(
      [
        { id: 'a', q: 0, units: cruisers },
        { id: 'b', q: 1 },
        { id: 'c', q: 2, planet: [unit(T.longBattery, BLUE), unit(T.battery, BLUE)] },
      ],
      cruisers,
    );
    const fired = events.filter((event) => event.type === 'SpaceCannonFired');
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({
      volley: { player: BLUE, hits: 1, rolls: [{ type: T.longBattery }] },
    });
  });

  it('RR 87.3/87.6: reihum ab dem aktiven Spieler; der aktive Spieler zielt auf seinen Gegner', () => {
    const cruisers = units(3, T.cruiser);
    const { events } = attack(
      [
        { id: 'a', q: 0, units: cruisers, planet: [unit(T.longBattery)] },
        { id: 'b', q: 1, units: [unit(T.cruiser, BLUE)] },
        { id: 'c', q: 2, planet: [unit(T.longBattery, GREEN)], planetController: GREEN },
      ],
      cruisers,
      MISS,
    );
    const volleys = events.flatMap((event) =>
      event.type === 'SpaceCannonFired' ? [[event.volley.player, event.volley.target]] : [],
    );
    expect(volleys).toEqual([
      [RED, BLUE],
      [GREEN, RED],
    ]);
  });
});

describe('Jägerabwehr (RR 41)', () => {
  it('RR 41: Treffer der Jägerabwehr zerstören nur Jäger, vor der ersten Kampfrunde', () => {
    const escort = unit(T.escort);
    const fighters = units(3, T.fighter, BLUE);
    const cruiser = unit(T.cruiser, BLUE);
    const { events } = attack(
      [
        { id: 'a', q: 0, units: [escort] },
        { id: 'b', q: 1, units: [...fighters, cruiser] },
      ],
      [escort],
      // Jägerabwehr verfehlt zweimal, danach treffen alle Würfe.
      new ScriptedRandom([1, 1, 10, 10, 10, 10, 10]),
    );
    const barrage = events.find((event) => event.type === 'AntiFighterBarrageFired');
    expect(barrage).toMatchObject({ volley: { player: RED, hits: 0 }, destroyed: [] });
    const roundOne = events.findIndex((event) => event.type === 'CombatRoundRolled');
    expect(events.indexOf(barrage as GameEvent)).toBeLessThan(roundOne);
  });

  it('RR 41: überzählige Treffer verfallen, wenn es weniger Jäger gibt', () => {
    const escort = unit(T.escort);
    const fighter = unit(T.fighter, BLUE);
    const cruiser = unit(T.cruiser, BLUE);
    const { events } = attack(
      [
        { id: 'a', q: 0, units: [escort] },
        { id: 'b', q: 1, units: [fighter, cruiser] },
      ],
      [escort],
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'AntiFighterBarrageFired', destroyed: [fighter.id] }),
    );
  });
});

describe('Raumkampf (RR 63)', () => {
  it('RR 63.5: beide Seiten würfeln, Angreifer zuerst; zwingende Treffer werden zugewiesen', () => {
    const red = unit(T.cruiser);
    const blue = unit(T.cruiser, BLUE);
    const { state, events } = attack(
      [
        { id: 'a', q: 0, units: [red] },
        { id: 'b', q: 1, units: [blue] },
      ],
      [red],
    );
    const rolled = events.find((event) => event.type === 'CombatRoundRolled');
    expect(rolled).toMatchObject({ round: 1, volleys: [{ player: RED }, { player: BLUE }] });
    expect(events).toContainEqual({ type: 'SpaceCombatEnded', system: S('b'), winner: null });
    expect(state.systems.b?.spaceUnits).toEqual([]);
    expect(state.actionPhase?.tactical).toMatchObject({ step: 'done', combat: null });
  });

  it('RR 63.6: ohne Sieger in einer Runde folgt die nächste Runde', () => {
    const red = unit(T.cruiser);
    const blue = unit(T.cruiser, BLUE);
    const { events } = attack(
      [
        { id: 'a', q: 0, units: [red] },
        { id: 'b', q: 1, units: [blue] },
      ],
      [red],
      new ScriptedRandom([1, 1, 10, 1]),
    );
    const rounds = events.flatMap((event) =>
      event.type === 'CombatRoundRolled' ? [event.round] : [],
    );
    expect(rounds).toEqual([1, 2]);
    expect(events).toContainEqual({ type: 'SpaceCombatEnded', system: S('b'), winner: RED });
  });

  it('RR 66: Schadensresistenz fängt einen Treffer ab, die Einheit ist danach beschädigt', () => {
    const battleship = unit(T.battleship);
    const blue = unit(T.cruiser, BLUE);
    const { state } = attack(
      [
        { id: 'a', q: 0, units: [battleship] },
        { id: 'b', q: 1, units: [blue] },
      ],
      [battleship],
    );
    expect(tacticalDecider(state)).toBe(RED);
    const after = step(state, assign(RED, [battleship]));
    const damaged = after.state.systems.b?.spaceUnits.find((u) => u.id === battleship.id);
    expect(damaged?.damaged).toBe(true);
    expect(after.events).toContainEqual({ type: 'SpaceCombatEnded', system: S('b'), winner: RED });
  });

  it('RR 89.1/66: Trefferzuweisung wird geprüft', () => {
    const battleship = unit(T.battleship);
    const cruiser = unit(T.cruiser);
    const { state } = attack(
      [
        { id: 'a', q: 0, units: [battleship, cruiser] },
        { id: 'b', q: 1, units: [unit(T.cruiser, BLUE)] },
      ],
      [battleship, cruiser],
    );
    const tryAssign = (command: ReturnType<typeof assign>) =>
      codeOf(assignHitsHandler.decide(state, command, contextWith()));
    expect(tryAssign(assign(RED, [cruiser]))).toBe('combat.cannotSustain');
    expect(tryAssign(assign(RED, [], [cruiser, battleship]))).toBe('combat.hitCount');
    expect(tryAssign(assign(RED, [], [unit(T.cruiser)]))).toBe('combat.unknownUnit');
    expect(tryAssign(assign(BLUE, [], []))).toBe('combat.noPendingHits');
    expect(tryAssign(assign(RED, [], [cruiser]))).toBe('ok');
  });

  it('RR 63.10: überzählige Jäger des Siegers gehen verloren, Jäger zuerst', () => {
    const carrier = unit(T.carrier);
    const battleship = unit(T.battleship);
    const fighters = units(2, T.fighter);
    const { state } = attack(
      [
        { id: 'a', q: 0, units: [carrier, battleship, ...fighters] },
        { id: 'b', q: 1, units: [unit(T.cruiser, BLUE)] },
      ],
      [carrier, battleship],
      HIT,
      fighters,
    );
    const after = step(state, assign(RED, [], [carrier]));
    expect(after.events).toContainEqual({
      type: 'UnitsDestroyed',
      system: S('b'),
      units: [fighters[0]?.id],
    });
    expect(after.state.systems.b?.spaceUnits.map((u) => u.id)).toEqual([
      battleship.id,
      fighters[1]?.id,
    ]);
  });
});

describe('Rückzug (RR 63.7)', () => {
  const retreatBoard = (red: Unit, blue: Unit): readonly Spec[] => [
    // Ein eigener Planet macht `a` zu einem gültigen Rückzugsziel für Rot.
    { id: 'a', q: 0, units: [red], planet: [], planetController: RED },
    { id: 'b', q: 1, units: [blue] },
    { id: 'c', q: 2, planet: [], planetController: BLUE },
  ];

  it('RR 63.7: Ziel muss angrenzen, frei von fremden Schiffen sein und Eigenes enthalten', () => {
    const red = unit(T.cruiser);
    const blue = unit(T.cruiser, BLUE);
    const state = board(...retreatBoard(red, blue), { id: 'd', q: 3, units: [unit(T.cruiser)] });
    expect(retreatTargets(state, S('b'), BLUE, catalog)).toEqual([S('c')]);
    expect(retreatTargets(state, S('b'), RED, catalog)).toEqual([S('a')]);
    // Von `c` aus: `b` hat ein eigenes Schiff, `d` ist durch ein fremdes Schiff versperrt.
    expect(retreatTargets(state, S('c'), BLUE, catalog)).toEqual([S('b')]);
    expect(retreatTargets(state, S('x'), RED, catalog)).toEqual([]);
  });

  it('RR 63.5: zuerst kündigt der Verteidiger an, dann der Angreifer', () => {
    const red = unit(T.cruiser);
    const blue = unit(T.cruiser, BLUE);
    const { state } = attack(retreatBoard(red, blue), [red], MISS);
    expect(state.actionPhase?.tactical?.combat?.awaitingRetreat).toEqual([BLUE, RED]);
    expect(tacticalDecider(state)).toBe(BLUE);
    const wrong = declareRetreatHandler.decide(state, retreat(RED, 'a'), contextWith());
    expect(codeOf(wrong)).toBe('combat.notYourDecision');
    const stays = step(state, retreat(BLUE, null)).state;
    expect(tacticalDecider(stays)).toBe(RED);
  });

  it('RR 63.7: nach der Ankündigung des Verteidigers darf der Angreifer nicht mehr zurückziehen', () => {
    const red = unit(T.cruiser);
    const blue = unit(T.cruiser, BLUE);
    const { state } = attack(retreatBoard(red, blue), [red], MISS);
    const bad = declareRetreatHandler.decide(state, retreat(BLUE, 'a'), contextWith());
    expect(codeOf(bad)).toBe('combat.invalidRetreat');
    const after = step(state, retreat(BLUE, 'c'), contextWith(MISS));
    expect(after.events).toContainEqual({ type: 'RetreatDeclared', player: BLUE, to: S('c') });
    expect(after.events.filter((event) => event.type === 'RetreatDeclared')).toHaveLength(1);
    expect(locateUnit(after.state, blue.id)?.system).toBe(S('c'));
    expect(after.events).toContainEqual({ type: 'SpaceCombatEnded', system: S('b'), winner: RED });
  });

  it('RR 63.7: der Rückzug legt einen Kommandomarker ins Zielsystem', () => {
    const red = unit(T.cruiser);
    const blue = unit(T.cruiser, BLUE);
    const { state } = attack(retreatBoard(red, blue), [red], MISS);
    const before = state.players.find((p) => p.id === BLUE)?.reinforcementTokens ?? 0;
    const after = step(state, retreat(BLUE, 'c'), contextWith(MISS)).state;
    expect(after.systems.c?.commandTokens).toEqual([BLUE]);
    expect(after.players.find((p) => p.id === BLUE)?.reinforcementTokens).toBe(before - 1);
  });

  it('RR 63.7: liegt dort schon ein eigener Marker, wird kein weiterer gelegt', () => {
    const red = unit(T.cruiser);
    const blue = unit(T.cruiser, BLUE);
    const specs = retreatBoard(red, blue).map((spec) =>
      spec.id === 'c' ? { ...spec, tokens: [BLUE] } : spec,
    );
    const { state } = attack(specs, [red], MISS);
    const after = step(state, retreat(BLUE, 'c'), contextWith(MISS));
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: 'ShipsRetreated', token: null }),
    );
    expect(after.state.systems.c?.commandTokens).toEqual([BLUE]);
  });

  it('RR 63.7: Bodentruppen im Weltraum ziehen mit ihren Schiffen ab', () => {
    const red = unit(T.cruiser);
    const blue = unit(T.carrier, BLUE);
    const infantry = unit(T.infantry, BLUE);
    const specs = retreatBoard(red, blue).map((spec) =>
      spec.id === 'b' ? { ...spec, units: [blue, infantry] } : spec,
    );
    const { state } = attack(specs, [red], MISS);
    const after = step(state, retreat(BLUE, 'c'), contextWith(MISS)).state;
    expect(locateUnit(after, infantry.id)?.system).toBe(S('c'));
  });
});

describe('Hilfen für Oberfläche und Bots', () => {
  it('RR 66: der Vorschlag nutzt erst Schadensresistenz, dann die günstigsten Einheiten', () => {
    const battleship = unit(T.battleship);
    const cruiser = unit(T.cruiser);
    const fighter = unit(T.fighter);
    const ships = [battleship, cruiser, fighter];
    expect(absorbableHits(ships, catalog)).toBe(4);
    const suggestion = suggestHitAssignment(ships, 2, catalog);
    expect(suggestion).toEqual({ sustained: [battleship.id], destroyed: [fighter.id] });
    expect(validateHitAssignment(ships, 2, suggestion, catalog).ok).toBe(true);
    const duplicate = { sustained: [], destroyed: [fighter.id, fighter.id] };
    expect(codeOf(validateHitAssignment(ships, 2, duplicate, catalog))).toBe('combat.duplicateHit');
  });

  it('ohne laufende Taktikaktion entscheidet niemand im Kampf', () => {
    expect(tacticalDecider(board({ id: 'a', q: 0 }))).toBeNull();
  });
});
