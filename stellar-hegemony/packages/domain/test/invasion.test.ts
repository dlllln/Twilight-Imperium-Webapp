import { describe, expect, it } from 'vitest';
import {
  bombardablePlanets,
  bombardHandler,
  bombardingShips,
  commitGroundForcesHandler,
  type GameEvent,
  type GameState,
  groundForcesOn,
  landingForces,
  type PlayerId,
  type Unit,
  updatePlayer,
} from '../src/index.ts';
import { activate, board, moves, order, planetOf, S, type Spec } from './board.ts';
import { BLUE, catalog, contextWith, RED, ScriptedRandom, T, unit, units } from './fixtures.ts';
import { run, step } from './game-flow.ts';

const HIT = new ScriptedRandom([10]);

const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? 'ok' : result.error?.code;

/** Rot fliegt einen Träger mit Fracht (und weitere Schiffe) von `a` nach `b`. */
function arrive(
  specs: readonly Spec[],
  carrier: Unit,
  cargo: readonly Unit[],
  others: readonly Unit[] = [],
  random = HIT,
) {
  const activated = run(board(...specs), [activate('b')]);
  const orders = [order(carrier, ['b'], cargo), ...others.map((ship) => order(ship, ['b']))];
  return step(activated, moves(...orders), contextWith(random)).state;
}

const land = (cargo: readonly Unit[], planet: string, centerPayment = null as never) =>
  ({
    type: 'CommitGroundForces',
    issuedBy: RED,
    landings: cargo.map((entry) => ({ unit: entry.id, planet: planetOf({ id: planet, q: 0 }) })),
    centerPayment,
  }) as const;

const stepOf = (state: GameState) => state.actionPhase?.tactical?.step;
const types = (events: readonly GameEvent[]) => events.map((event) => event.type);
const controllerOf = (state: GameState, planet: string) =>
  state.planets[planetOf({ id: planet, q: 0 })]?.controller;

/** Feindplanet in `b`: Blau kontrolliert ihn mit den angegebenen Einheiten. */
const enemyWorld = (planet: readonly Unit[], owner: PlayerId = BLUE): Spec => ({
  id: 'b',
  q: 1,
  planet,
  planetController: owner,
});

describe('Bombardement (RR 20, RR 60)', () => {
  it('RR 20.1: Treffer zerstören fremde Bodentruppen auf dem gewählten Planeten', () => {
    const battleship = unit(T.battleship);
    const carrier = unit(T.carrier);
    const infantry = units(2, T.infantry);
    const defenders = units(2, T.infantry, BLUE);
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, battleship, ...infantry] }, enemyWorld(defenders)],
      carrier,
      infantry,
      [battleship],
    );
    expect(stepOf(state)).toBe('bombardment');
    const target = { unit: battleship.id, planet: planetOf({ id: 'b', q: 1 }) };
    const after = step(
      state,
      { type: 'Bombard', issuedBy: RED, targets: [target] },
      contextWith(HIT),
    );
    expect(after.events[0]).toMatchObject({
      type: 'BombardmentRolled',
      destroyed: [defenders[0]?.id],
    });
    expect(stepOf(after.state)).toBe('invasion');
  });

  it('RR 60.1: ein fremder Planetarer Schild verhindert Bombardement, eine Schildbrecher-Einheit hebt ihn auf', () => {
    const shielded = board(
      { id: 'a', q: 0 },
      {
        ...enemyWorld([unit(T.infantry, BLUE), unit(T.battery, BLUE)]),
        units: [unit(T.battleship)],
      },
    );
    expect(bombardablePlanets(shielded, S('b'), RED, catalog)).toEqual([]);
    const lifted = board(
      { id: 'a', q: 0 },
      { ...enemyWorld([unit(T.infantry, BLUE), unit(T.battery, BLUE)]), units: [unit(T.breaker)] },
    );
    expect(bombardablePlanets(lifted, S('b'), RED, catalog)).toEqual([planetOf({ id: 'b', q: 1 })]);
  });

  it('unbekannte Systeme und Planeten ergeben leere Listen', () => {
    const state = board({ id: 'a', q: 0 });
    const nowhere = S('nirgendwo');
    expect(bombardablePlanets(state, nowhere, RED, catalog)).toEqual([]);
    expect(bombardingShips(state, nowhere, RED, catalog)).toEqual([]);
    expect(landingForces(state, nowhere, RED, catalog)).toEqual([]);
    expect(groundForcesOn(state, planetOf({ id: 'nirgendwo', q: 0 }), catalog, () => true)).toEqual(
      [],
    );
  });

  it('RR 20.1: nur eigene Einheiten mit Bombardement und nur erlaubte Planeten', () => {
    const battleship = unit(T.battleship);
    const carrier = unit(T.carrier);
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, battleship] }, enemyWorld([unit(T.infantry, BLUE)])],
      carrier,
      [],
      [battleship],
    );
    const planet = planetOf({ id: 'b', q: 1 });
    const tryBombard = (targets: readonly { unit: Unit['id']; planet: typeof planet }[]) =>
      codeOf(
        bombardHandler.decide(state, { type: 'Bombard', issuedBy: RED, targets }, contextWith()),
      );
    expect(tryBombard([{ unit: carrier.id, planet }])).toBe('invasion.cannotBombard');
    expect(tryBombard([{ unit: battleship.id, planet: planetOf({ id: 'x', q: 0 }) }])).toBe(
      'invasion.invalidBombardTarget',
    );
    expect(tryBombard([])).toBe('ok');
  });
});

describe('Einmarsch (RR 25, RR 87.7)', () => {
  it('RR 25.4/25.5: Bodenkampf bis eine Seite übrig ist, dann Kontrolle; fremde Gebäude fallen', () => {
    const carrier = unit(T.carrier);
    const infantry = units(2, T.infantry);
    const dock = unit(T.dock, BLUE);
    const state = arrive(
      [
        { id: 'a', q: 0, units: [carrier, ...infantry] },
        enemyWorld([unit(T.infantry, BLUE), dock]),
      ],
      carrier,
      infantry,
    );
    expect(stepOf(state)).toBe('invasion');
    const after = step(state, land(infantry, 'b'), contextWith(HIT));
    expect(types(after.events)).toEqual([
      'GroundForcesCommitted',
      'GroundCombatRoundRolled',
      'GroundCombatEnded',
      'PlanetControlGained',
      'TacticalStepReached',
    ]);
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: 'PlanetControlGained', structuresDestroyed: [dock.id] }),
    );
    const planet = after.state.planets[planetOf({ id: 'b', q: 1 })];
    expect(planet).toMatchObject({ controller: RED, exhausted: true });
    expect(planet?.units.map((u) => u.owner)).toEqual([RED]);
  });

  it('RR 25.4: verliert der Angreifer alle Bodentruppen, bleibt die Kontrolle beim Verteidiger', () => {
    const carrier = unit(T.carrier);
    const infantry = [unit(T.infantry)];
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, ...infantry] }, enemyWorld(units(2, T.infantry, BLUE))],
      carrier,
      infantry,
    );
    const after = step(state, land(infantry, 'b'), contextWith(HIT));
    expect(after.events).toContainEqual({
      type: 'GroundCombatEnded',
      planet: planetOf({ id: 'b', q: 1 }),
      winner: BLUE,
    });
    expect(controllerOf(after.state, 'b')).toBe(BLUE);
  });

  it('RR 87.7: Weltraumkanonen auf dem Planeten schießen auf die Gelandeten', () => {
    const carrier = unit(T.carrier);
    const infantry = units(2, T.infantry);
    const battery = unit(T.battery, BLUE);
    // Offensivfeuer der Batterie verfehlt beim Eintreffen (1), Abwehrfeuer trifft (10).
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, ...infantry] }, enemyWorld([battery])],
      carrier,
      infantry,
      [],
      new ScriptedRandom([1]),
    );
    const after = step(state, land(infantry, 'b'), contextWith(HIT));
    expect(after.events[1]).toMatchObject({
      type: 'SpaceCannonDefenseFired',
      volley: { player: BLUE, target: RED, hits: 1 },
      destroyed: [infantry[0]?.id],
    });
    expect(controllerOf(after.state, 'b')).toBe(RED);
  });

  it('RR 25.5: ein unbesetzter Planet wird ohne Kampf übernommen', () => {
    const carrier = unit(T.carrier);
    const infantry = [unit(T.infantry)];
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, ...infantry] }, enemyWorld([], null as never)],
      carrier,
      infantry,
    );
    const after = step(state, land(infantry, 'b'));
    expect(types(after.events)).toEqual([
      'GroundForcesCommitted',
      'PlanetControlGained',
      'TacticalStepReached',
    ]);
    expect(controllerOf(after.state, 'b')).toBe(RED);
  });

  it('RR 25.2: nur eigene Bodentruppen aus dem Weltraum, nur Planeten im aktiven System', () => {
    const carrier = unit(T.carrier);
    const infantry = [unit(T.infantry)];
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, ...infantry] }, enemyWorld([])],
      carrier,
      infantry,
    );
    const tryLand = (command: ReturnType<typeof land>) =>
      codeOf(commitGroundForcesHandler.decide(state, command, contextWith()));
    expect(tryLand(land([unit(T.infantry)], 'b'))).toBe('invasion.notLandable');
    expect(tryLand(land(infantry, 'x'))).toBe('invasion.unknownPlanet');
    expect(tryLand(land([...infantry, ...infantry], 'b'))).toBe('invasion.duplicateUnit');
    const skipped = step(state, land([], 'b'));
    expect(types(skipped.events)).toEqual(['TacticalStepReached']);
    expect(stepOf(skipped.state)).toBe('done');
  });

  it('RR 25 (Thronwelt): Landung kostet Einfluss und bringt einen Siegpunkt', () => {
    const carrier = unit(T.carrier);
    const infantry = [unit(T.infantry)];
    const throne: Spec = {
      id: 'center',
      q: 1,
      planet: [],
      planetController: null,
      planetId: 'throne',
    };
    const specs = [{ id: 'a', q: 0, units: [carrier, ...infantry] }, throne];
    const activated = run(board(...specs), [activate('center')]);
    const rich = updatePlayer(activated, RED, (player) => ({ ...player, tradeGoods: 6 }));
    const state = step(rich, moves(order(carrier, ['center'], infantry)), contextWith(HIT)).state;
    const landing = (payment: { planets: never[]; tradeGoods: number } | null) =>
      ({
        type: 'CommitGroundForces',
        issuedBy: RED,
        landings: [{ unit: infantry[0]?.id as Unit['id'], planet: planetOf(throne) }],
        centerPayment: payment,
      }) as const;
    const tooLittle = commitGroundForcesHandler.decide(
      state,
      landing({ planets: [], tradeGoods: 5 }),
      contextWith(),
    );
    expect(codeOf(tooLittle)).toBe('invasion.centerPayment');
    const after = step(state, landing({ planets: [], tradeGoods: 6 })).state;
    expect(after.centerTokenRemoved).toBe(true);
    expect(after.players.find((p) => p.id === RED)).toMatchObject({
      victoryPoints: 1,
      tradeGoods: 0,
    });
    expect(after.planets[planetOf(throne)]?.controller).toBe(RED);
  });
});
