import { describe, expect, it } from 'vitest';
import {
  activateSystemHandler,
  endTacticalActionHandler,
  evolveGame,
  findShipPath,
  type GameState,
  locateUnit,
  movementOptions,
  moveShipsHandler,
  passHandler,
  planetId,
  type ShipMoveOrder,
  type SystemState,
  type Unit,
  unitId,
  unitTypeId,
  updatePlayer,
} from '../src/index.ts';
import {
  BLUE,
  catalog,
  contextWith,
  RED,
  RULES,
  ScriptedRandom,
  T,
  unit,
  units,
} from './fixtures.ts';
import { activate, board, moves, order, S } from './board.ts';
import { run, step } from './game-flow.ts';

const PLANET_A = planetId('p-a');

/** Ohne Weltraumkanonen und Gegner laufen die Schritte der Taktikaktion durch. */
const STEPS_WITHOUT_COMBAT = [
  'TacticalStepReached',
  'TacticalStepReached',
  'TacticalStepReached',
] as const;

/** Aktiviert das letzte System der Reihe und versucht die Bewegung. */
function tryMove(state: GameState, active: string, ...orders: readonly ShipMoveOrder[]) {
  const activated = run(state, [activate(active)]);
  // Treffer bei jedem Wurf, damit ausgelöste Raumkämpfe schnell enden.
  return moveShipsHandler.decide(
    activated,
    moves(...orders),
    contextWith(new ScriptedRandom([10])),
  );
}

const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? 'ok' : result.error?.code;

describe('Aktivierung (RR 79.1)', () => {
  it('Kommandomarker aus dem Taktikpool ins System; die Taktikaktion beginnt', () => {
    const state = board({ id: 'a', q: 0 }, { id: 'b', q: 1 });
    const { state: after, events } = step(state, activate('b'));
    expect(events).toEqual([{ type: 'SystemActivated', player: RED, system: S('b') }]);
    expect(after.systems.b?.commandTokens).toEqual([RED]);
    expect(after.players[0]?.commandPools.tactic).toBe(2);
    expect(after.actionPhase?.tactical).toEqual({
      system: S('b'),
      step: 'movement',
      pendingHits: [],
      combat: null,
    });
  });

  it('nicht ohne Taktikmarker, nicht doppelt, nur im bekannten System und nur am Zug', () => {
    const state = board({ id: 'a', q: 0, tokens: [RED] }, { id: 'b', q: 1, tokens: [BLUE] });
    const decide = (s: GameState, command: ReturnType<typeof activate>) =>
      codeOf(activateSystemHandler.decide(s, command));
    expect(decide(state, activate('a'))).toBe('tactical.alreadyActivated');
    expect(decide(state, activate('b'))).toBe('ok');
    expect(decide(state, activate('x'))).toBe('tactical.unknownSystem');
    expect(decide(state, activate('b', BLUE))).toBe('action.notYourTurn');
    const empty = updatePlayer(state, RED, (p) => ({
      ...p,
      commandPools: { ...p.commandPools, tactic: 0 },
    }));
    expect(decide(empty, activate('b'))).toBe('tactical.noTacticToken');
  });

  it('während einer Taktikaktion keine zweite Aktion und kein Passen', () => {
    const active = run(board({ id: 'a', q: 0 }, { id: 'b', q: 1 }), [activate('b')]);
    expect(codeOf(activateSystemHandler.decide(active, activate('a')))).toBe('action.tacticalOpen');
    expect(codeOf(passHandler.decide(active, { type: 'Pass', issuedBy: RED }))).toBe(
      'action.tacticalOpen',
    );
  });
});

describe('Bewegung (RR 15, RR 79.2)', () => {
  it('ein Kreuzer fliegt zwei Systeme weit ins aktive System', () => {
    const cruiser = unit(T.cruiser);
    const state = board({ id: 'a', q: 0, units: [cruiser] }, { id: 'b', q: 1 }, { id: 'c', q: 2 });
    const activated = run(state, [activate('c')]);
    const { state: after, events } = step(activated, moves(order(cruiser, ['b', 'c'])));
    expect(events.map((event) => event.type)).toEqual(['ShipsMoved', ...STEPS_WITHOUT_COMBAT]);
    expect(locateUnit(after, cruiser.id)?.system).toBe(S('c'));
    expect(after.systems.a?.spaceUnits).toEqual([]);
    expect(after.actionPhase?.tactical?.step).toBe('done');
  });

  it('RR 16: Bewegungswert, Nachbarschaft und Ziel werden geprüft', () => {
    const carrier = unit(T.carrier);
    const state = board({ id: 'a', q: 0, units: [carrier] }, { id: 'b', q: 1 }, { id: 'c', q: 2 });
    expect(codeOf(tryMove(state, 'c', order(carrier, ['b', 'c'])))).toBe('move.tooFar');
    expect(codeOf(tryMove(state, 'c', order(carrier, ['c'])))).toBe('move.notAdjacent');
    expect(codeOf(tryMove(state, 'c', order(carrier, ['b'])))).toBe('move.mustEndInActive');
    expect(codeOf(tryMove(state, 'c', order(carrier, ['x', 'c'])))).toBe('move.unknownSystem');
  });

  it('nur eigene, bewegliche Schiffe; nicht aus Systemen mit eigenem Marker', () => {
    const foreign = unit(T.cruiser, BLUE);
    const fighter = unit(T.fighter);
    const parked = unit(T.cruiser);
    const state = board(
      { id: 'a', q: 0, units: [foreign, fighter] },
      { id: 'b', q: 1, units: [parked], tokens: [RED] },
      { id: 'c', q: 2 },
    );
    expect(codeOf(tryMove(state, 'c', order(foreign, ['b', 'c'])))).toBe('move.notYourShip');
    expect(codeOf(tryMove(state, 'c', order(fighter, ['b', 'c'])))).toBe('move.cannotMove');
    expect(codeOf(tryMove(state, 'c', order(parked, ['c'])))).toBe('move.originHasToken');
    const ghost = { ...unit(T.cruiser), id: unitId('gibt-es-nicht') };
    expect(codeOf(tryMove(state, 'c', order(ghost, ['c'])))).toBe('move.unknownShip');
    const odd = { ...unit(T.cruiser), type: unitTypeId('raetsel') };
    const withOdd = board({ id: 'a', q: 0, units: [odd] }, { id: 'c', q: 1 });
    expect(codeOf(tryMove(withOdd, 'c', order(odd, ['c'])))).toBe('unit.unknownType');
  });

  it('RR 15.5: Schiffe dürfen das aktive System verlassen und zurückkehren', () => {
    const cruiser = unit(T.cruiser);
    const state = board({ id: 'a', q: 0 }, { id: 'b', q: 1, units: [cruiser] });
    expect(codeOf(tryMove(state, 'b', order(cruiser, ['a', 'b'])))).toBe('ok');
  });

  it('RR 15.5: fremde Nicht-Jäger-Schiffe versperren den Durchflug, fremde Jäger nicht', () => {
    const cruiser = unit(T.cruiser);
    const blocked = board(
      { id: 'a', q: 0, units: [cruiser] },
      { id: 'b', q: 1, units: [unit(T.cruiser, BLUE)] },
      { id: 'c', q: 2 },
    );
    expect(codeOf(tryMove(blocked, 'c', order(cruiser, ['b', 'c'])))).toBe('move.blocked');
    const fighters = board(
      { id: 'a', q: 0, units: [cruiser] },
      { id: 'b', q: 1, units: [unit(T.fighter, BLUE)] },
      { id: 'c', q: 2 },
    );
    expect(codeOf(tryMove(fighters, 'c', order(cruiser, ['b', 'c'])))).toBe('ok');
  });

  it('RR 15.5: ins aktive System darf man trotz fremder Schiffe', () => {
    const cruiser = unit(T.cruiser);
    const state = board(
      { id: 'a', q: 0, units: [cruiser] },
      { id: 'b', q: 1, units: [unit(T.cruiser, BLUE)] },
    );
    expect(codeOf(tryMove(state, 'b', order(cruiser, ['b'])))).toBe('ok');
  });
});

describe('Anomalien (RR 11, RR 33, RR 57, RR 77)', () => {
  it('RR 11/77: nicht in oder durch Asteroidenfeld und Supernova', () => {
    const cruiser = unit(T.cruiser);
    for (const anomaly of ['asteroidField', 'supernova'] as const) {
      const through = board(
        { id: 'a', q: 0, units: [cruiser] },
        { id: 'b', q: 1, anomaly },
        { id: 'c', q: 2 },
      );
      expect(codeOf(tryMove(through, 'c', order(cruiser, ['b', 'c'])))).toBe('move.blocked');
      const into = board({ id: 'a', q: 0, units: [cruiser] }, { id: 'b', q: 1, anomaly });
      expect(codeOf(tryMove(into, 'b', order(cruiser, ['b'])))).toBe('move.blocked');
    }
  });

  it('RR 57.1/57.3: in einen Nebel nur als aktives System, nicht hindurch', () => {
    const cruiser = unit(T.cruiser);
    const through = board(
      { id: 'a', q: 0, units: [cruiser] },
      { id: 'b', q: 1, anomaly: 'nebula' },
      { id: 'c', q: 2 },
    );
    expect(codeOf(tryMove(through, 'c', order(cruiser, ['b', 'c'])))).toBe('move.blocked');
    const into = board({ id: 'a', q: 0, units: [cruiser] }, { id: 'b', q: 1, anomaly: 'nebula' });
    expect(codeOf(tryMove(into, 'b', order(cruiser, ['b'])))).toBe('ok');
  });

  it('RR 57.2: wer im Nebel startet, hat Bewegungswert 1', () => {
    const cruiser = unit(T.cruiser);
    const state = board(
      { id: 'a', q: 0, units: [cruiser], anomaly: 'nebula' },
      { id: 'b', q: 1 },
      { id: 'c', q: 2 },
    );
    expect(codeOf(tryMove(state, 'c', order(cruiser, ['b', 'c'])))).toBe('move.tooFar');
  });

  it('RR 33.1: ein Strudel auf der Route gibt +1 Bewegung, danach wird gewürfelt', () => {
    const carrier = unit(T.carrier);
    const fighter = unit(T.fighter);
    const state = board(
      { id: 'a', q: 0, units: [carrier, fighter] },
      { id: 'b', q: 1, anomaly: 'gravityRift' },
      { id: 'c', q: 2 },
    );
    const activated = run(state, [activate('c')]);
    const survive = moveShipsHandler.decide(
      activated,
      moves(order(carrier, ['b', 'c'], [fighter])),
      contextWith(new ScriptedRandom([4])),
    );
    expect(survive.ok && survive.value.map((event) => event.type)).toEqual([
      'GravityRiftRolled',
      'ShipsMoved',
      ...STEPS_WITHOUT_COMBAT,
    ]);
    const lost = step(
      activated,
      moves(order(carrier, ['b', 'c'], [fighter])),
      contextWith(new ScriptedRandom([3])),
    );
    expect(lost.events.find((event) => event.type === 'UnitsDestroyed')).toEqual({
      type: 'UnitsDestroyed',
      system: S('c'),
      units: [carrier.id, fighter.id],
    });
    expect(lost.state.systems.c?.spaceUnits).toEqual([]);
  });

  it('wer im Strudel startet, würfelt beim Verlassen und darf weiter fliegen', () => {
    const carrier = unit(T.carrier);
    const state = board(
      { id: 'a', q: 0, units: [carrier], anomaly: 'gravityRift' },
      { id: 'b', q: 1 },
      { id: 'c', q: 2 },
    );
    const result = tryMove(state, 'c', order(carrier, ['b', 'c']));
    expect(
      result.ok && result.value.filter((event) => event.type === 'GravityRiftRolled'),
    ).toHaveLength(1);
  });
});

describe('Transport (RR 83) und Grenzen (RR 28, RR 43)', () => {
  it('Träger nehmen Jäger und Bodentruppen aus Start- und Durchflugsystem mit', () => {
    const carrier = unit(T.carrier);
    const fighter = unit(T.fighter);
    const infantry = unit(T.infantry);
    const passenger = unit(T.infantry);
    const state = board(
      { id: 'a', q: 0, units: [carrier, fighter], planet: [infantry] },
      { id: 'b', q: 1, units: [passenger], anomaly: 'gravityRift' },
      { id: 'c', q: 2 },
    );
    const activated = run(state, [activate('c')]);
    const { state: after, events } = step(
      activated,
      moves(order(carrier, ['b', 'c'], [fighter, infantry, passenger])),
      contextWith(new ScriptedRandom([9])),
    );
    expect(events.find((event) => event.type === 'ShipsMoved')).toMatchObject({
      movements: [
        {
          cargo: [
            { unit: fighter.id, system: S('a'), planet: null },
            { unit: infantry.id, system: S('a'), planet: PLANET_A },
            { unit: passenger.id, system: S('b'), planet: null },
          ],
        },
      ],
    });
    expect(after.systems.c?.spaceUnits).toHaveLength(4);
    expect(after.planets[PLANET_A]?.units).toEqual([]);
  });

  it('Fracht: eigene Jäger/Bodentruppen auf der Route, höchstens die Kapazität', () => {
    const carrier = unit(T.carrier);
    const cruiser = unit(T.cruiser);
    const foreign = unit(T.infantry, BLUE);
    const far = unit(T.fighter);
    const state = board(
      { id: 'a', q: 0, units: [carrier, cruiser, foreign, ...units(5, T.fighter)] },
      { id: 'b', q: 1 },
      { id: 'z', q: 5, units: [far] },
    );
    const fighters = state.systems.a?.spaceUnits.filter((u) => u.type === T.fighter) ?? [];
    const attempt = (cargo: readonly Unit[]) =>
      codeOf(tryMove(state, 'b', order(carrier, ['b'], cargo)));
    expect(attempt(fighters)).toBe('move.overCapacity');
    expect(attempt([foreign])).toBe('move.cargoNotYours');
    expect(attempt([cruiser])).toBe('move.cargoNotTransportable');
    expect(attempt([far])).toBe('move.cargoOutOfReach');
    expect(attempt([{ ...far, id: unitId('niemand') }])).toBe('move.cargoUnknown');
  });

  it('RR 83.3: keine Mitnahme aus Systemen mit eigenem Kommandomarker (außer dem aktiven)', () => {
    const carrier = unit(T.carrier);
    const stranded = unit(T.infantry);
    const waiting = unit(T.infantry);
    const state = board(
      { id: 'a', q: 0, units: [unit(T.cruiser)] },
      { id: 'b', q: 1, units: [stranded], tokens: [RED], anomaly: 'gravityRift' },
      { id: 'c', q: 2, units: [waiting] },
    );
    const withCarrier: GameState = {
      ...state,
      systems: {
        ...state.systems,
        a: { ...(state.systems.a as SystemState), spaceUnits: [carrier] },
      },
    };
    expect(codeOf(tryMove(withCarrier, 'c', order(carrier, ['b', 'c'], [stranded])))).toBe(
      'move.cargoOutOfReach',
    );
    expect(codeOf(tryMove(withCarrier, 'c', order(carrier, ['b', 'c'], [waiting])))).toBe('ok');
  });

  it('jede Einheit nur einmal', () => {
    const carrier = unit(T.carrier);
    const fighter = unit(T.fighter);
    const state = board({ id: 'a', q: 0, units: [carrier, fighter] }, { id: 'b', q: 1 });
    expect(codeOf(tryMove(state, 'b', order(carrier, ['b'], [fighter, fighter])))).toBe(
      'move.duplicateUnit',
    );
  });

  it('RR 28: nicht mehr Nicht-Jäger-Schiffe im aktiven System als Marker im Flottenpool', () => {
    const ships = units(2, T.cruiser);
    const state = updatePlayer(
      board({ id: 'a', q: 0, units: ships }, { id: 'b', q: 1 }),
      RED,
      (p) => ({ ...p, commandPools: { ...p.commandPools, fleet: 1 } }),
    );
    const [first, second] = ships as [Unit, Unit];
    expect(codeOf(tryMove(state, 'b', order(first, ['b']), order(second, ['b'])))).toBe(
      'move.fleetLimit',
    );
    expect(codeOf(tryMove(state, 'b', order(first, ['b'])))).toBe('ok');
  });

  it('RR 43.3: nicht mehr Jäger und Bodentruppen als Kapazität im aktiven System', () => {
    const cruiser = unit(T.cruiser);
    const state = board(
      { id: 'a', q: 0, units: [cruiser] },
      { id: 'b', q: 1, units: units(2, T.fighter) },
    );
    expect(codeOf(tryMove(state, 'b', order(cruiser, ['b'])))).toBe('move.capacity');
  });
});

describe('Ablauf der Taktikaktion', () => {
  it('erst bewegen, dann beenden; danach ist der Nächste am Zug', () => {
    const state = board({ id: 'a', q: 0 }, { id: 'b', q: 1 });
    const activated = run(state, [activate('b')]);
    const end = { type: 'EndTacticalAction', issuedBy: RED } as const;
    expect(codeOf(endTacticalActionHandler.decide(activated, end))).toBe('tactical.wrongStep');
    const moved = run(activated, [moves()]);
    expect(codeOf(moveShipsHandler.decide(moved, moves(), contextWith()))).toBe(
      'tactical.wrongStep',
    );
    const { state: after, events } = step(moved, end);
    expect(events).toEqual([
      { type: 'TacticalActionEnded', player: RED },
      { type: 'TurnEnded', player: RED, next: BLUE },
    ]);
    expect(after.actionPhase).toMatchObject({ active: BLUE, tactical: null });
  });

  it('ohne aktive Taktikaktion oder fremder Zug: keine Bewegung', () => {
    const state = board({ id: 'a', q: 0 }, { id: 'b', q: 1 });
    expect(codeOf(moveShipsHandler.decide(state, moves(), contextWith()))).toBe(
      'tactical.notActive',
    );
    const activated = run(state, [activate('b')]);
    expect(
      codeOf(moveShipsHandler.decide(activated, { ...moves(), issuedBy: BLUE }, contextWith())),
    ).toBe('action.notYourTurn');
  });

  it('zerstörte Einheiten verschwinden auch von Planeten', () => {
    const infantry = unit(T.infantry);
    const state = board({ id: 'a', q: 0, planet: [infantry] });
    const after = evolveGame(state, {
      type: 'UnitsDestroyed',
      system: S('a'),
      units: [infantry.id],
    });
    expect(after.planets[PLANET_A]?.units).toEqual([]);
  });
});

describe('Routensuche für Clients', () => {
  const context = (state: GameState, active: string) => ({
    state,
    player: RED,
    active: S(active),
    catalog,
    rules: RULES,
  });

  it('kürzeste regelkonforme Route, auch mit Strudel-Bonus', () => {
    const carrier = unit(T.carrier);
    const state = board(
      { id: 'a', q: 0, units: [carrier] },
      { id: 'b', q: 1, anomaly: 'gravityRift' },
      { id: 'c', q: 2 },
      { id: 'd', q: 3 },
    );
    expect(findShipPath(context(state, 'c'), carrier.id)).toEqual([S('b'), S('c')]);
    expect(findShipPath(context(state, 'd'), carrier.id)).toBeUndefined();
    expect(findShipPath(context(state, 'd'), unitId('niemand'))).toBeUndefined();
  });

  it('listet nur eigene Schiffe, die das aktive System erreichen und starten dürfen', () => {
    const near = unit(T.cruiser);
    const parked = unit(T.cruiser);
    const far = unit(T.carrier);
    const state = board(
      { id: 'a', q: 0, units: [far] },
      { id: 'b', q: 1, units: [near, unit(T.fighter), unit(T.cruiser, BLUE)] },
      { id: 'c', q: 2, units: [parked], tokens: [RED] },
      { id: 'd', q: 3 },
    );
    const options = movementOptions(context(state, 'd'));
    expect(options.map((option) => option.ship.id)).toEqual([near.id]);
    expect(options[0]?.path).toEqual([S('c'), S('d')]);
  });
});
