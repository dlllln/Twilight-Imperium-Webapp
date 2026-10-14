import { describe, expect, it } from 'vitest';
import {
  bombardablePlanets,
  type ContentPort,
  type DecisionContext,
  evolveGame,
  type FactionAbility,
  type GameEvent,
  type GameState,
  isReversible,
  moveShipsHandler,
  planetId,
  type PlanetId,
  produceUnitsHandler,
  productionQuote,
  type RandomPort,
  technologyCatalog,
  type Unit,
  type UnitTypeId,
  unitTypeId,
  updatePlayer,
} from '../src/index.ts';
import { activate, board, moves, order, planetOf, S, type Spec } from './board.ts';
import {
  BLUE,
  content,
  contextWith,
  FACTIONS,
  RED,
  ScriptedRandom,
  T,
  unit,
  units,
} from './fixtures.ts';
import { run, step } from './game-flow.ts';

const HIT = new ScriptedRandom([10]);
const B = planetOf({ id: 'b', q: 1 });
const WORLD = planetId('gamma-1');

/** Feindplanet in `b`: Blau (oder niemand) kontrolliert ihn mit den angegebenen Einheiten. */
const enemyWorld = (planet: readonly Unit[], owner: Spec['planetController'] = BLUE): Spec => ({
  id: 'b',
  q: 1,
  planet,
  planetController: owner,
});

/** Rot fliegt einen Träger mit Fracht (und weitere Schiffe) von `a` nach `b`. */
function arrive(
  specs: readonly Spec[],
  carrier: Unit,
  cargo: readonly Unit[],
  others: readonly Unit[] = [],
  random: RandomPort = HIT,
): GameState {
  const activated = run(board(...specs), [activate('b')]);
  const orders = [order(carrier, ['b'], cargo), ...others.map((ship) => order(ship, ['b']))];
  return step(activated, moves(...orders), contextWith(random)).state;
}

const land = (cargo: readonly Unit[]) =>
  ({
    type: 'CommitGroundForces',
    issuedBy: RED,
    landings: cargo.map((entry) => ({ unit: entry.id, planet: B })),
    centerPayment: null,
  }) as const;

const types = (events: readonly GameEvent[]) => events.map((event) => event.type);
const unitOn = (state: GameState, planet: PlanetId, id: Unit['id']) =>
  state.planets[planet]?.units.find((candidate) => candidate.id === id);

/** Rot aktiviert `b` mit eigenem Dock auf Gamma-1 (3 Ressourcen + 2 = Produktion 5). */
function atDock(extra: readonly Unit[] = [], context: DecisionContext = contextWith()): GameState {
  const home: Spec = { id: 'b', q: 1, planet: [unit(T.dock), ...extra], planetId: 'gamma-1' };
  const activated = run(board({ id: 'a', q: 0 }, home), [activate('b')], context);
  const rich = updatePlayer(activated, RED, (player) => ({ ...player, tradeGoods: 20 }));
  return step(rich, moves(), context).state;
}

const produce = (orders: readonly { type: UnitTypeId; count: number }[], tradeGoods = 10) =>
  ({
    type: 'ProduceUnits',
    issuedBy: RED,
    orders,
    payment: { planets: [], tradeGoods },
    groundPlanet: orders.some((o) => o.type === T.infantry || o.type === T.mech) ? WORLD : null,
  }) as const;

const tryProduce = (state: GameState, command: ReturnType<typeof produce>) => {
  const result = produceUnitsHandler.decide(state, command, contextWith());
  return result.ok ? 'ok' : result.error.code;
};

describe('Mechs: Produktion und Transport (PoK Mech)', () => {
  it('PoK Mech: Mechs kosten 2 Ressourcen je Stück, zählen 1 zum Produktionslimit und kommen auf den Planeten', () => {
    const state = atDock();
    const mechs = [{ type: T.mech, count: 2 }];
    expect(productionQuote(state, S('b'), RED, mechs, content)).toMatchObject({
      count: 2,
      cost: 4,
      limit: 5,
    });
    expect(tryProduce(state, produce([...mechs, { type: T.infantry, count: 4 }]))).toBe(
      'production.limit',
    );
    expect(tryProduce(state, produce(mechs, 3))).toBe('production.cost');
    const after = step(state, produce([...mechs, { type: T.infantry, count: 2 }], 5)).state;
    const ground = after.planets[WORLD]?.units.filter((u) => u.type === T.mech) ?? [];
    expect(ground).toHaveLength(2);
  });

  it('RR 24.5 / PoK Mech: höchstens 4 Mechs im Vorrat', () => {
    const state = atDock(units(3, T.mech));
    expect(tryProduce(state, produce([{ type: T.mech, count: 2 }]))).toBe(
      'production.componentLimit',
    );
    expect(tryProduce(state, produce([{ type: T.mech, count: 1 }]))).toBe('ok');
  });

  it('RR 43 / PoK Mech: Mechs fliegen als Fracht mit und belegen Kapazität wie Infanterie', () => {
    const carrier = unit(T.carrier);
    const cargo = [...units(2, T.mech), ...units(3, T.infantry)];
    // Die Fracht wartet auf dem Planeten, im Weltraum ginge der Überschuss verloren (RR 43.3).
    const origin: Spec = { id: 'a', q: 0, units: [carrier], planet: cargo };
    const activated = run(board(origin, { id: 'b', q: 1 }), [activate('b')]);
    const tooMuch = moveShipsHandler.decide(
      activated,
      moves(order(carrier, ['b'], cargo)),
      contextWith(),
    );
    expect(tooMuch.ok ? 'ok' : tooMuch.error.code).toBe('move.overCapacity');
    const moved = step(activated, moves(order(carrier, ['b'], cargo.slice(0, 4)))).state;
    expect(moved.systems.b?.spaceUnits.filter((u) => u.type === T.mech)).toHaveLength(2);
  });
});

describe('Mechs: Schadensresistenz am Boden (PoK Mech)', () => {
  it('PoK Mech: im Bodenkampf fängt ein unbeschädigter Mech einen Treffer ab', () => {
    const carrier = unit(T.carrier);
    const mech = unit(T.mech);
    const cargo = [mech, unit(T.infantry)];
    const defender = unit(T.infantry, BLUE);
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, ...cargo] }, enemyWorld([defender])],
      carrier,
      cargo,
    );
    const after = step(state, land(cargo), contextWith(HIT));
    expect(after.events).toContainEqual(
      expect.objectContaining({
        type: 'GroundCombatRoundRolled',
        sustained: [mech.id],
        destroyed: [defender.id],
      }),
    );
    expect(unitOn(after.state, B, mech.id)?.damaged).toBe(true);
    expect(after.state.planets[B]?.controller).toBe(RED);
  });

  it('PoK Mech: ein beschädigter Mech fängt keinen weiteren Treffer ab', () => {
    const carrier = unit(T.carrier);
    const mech = unit(T.mech, RED, true);
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, mech] }, enemyWorld([unit(T.infantry, BLUE)])],
      carrier,
      [mech],
    );
    const after = step(state, land([mech]), contextWith(HIT));
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: 'GroundCombatRoundRolled', sustained: [] }),
    );
    expect(after.events).toContainEqual({ type: 'GroundCombatEnded', planet: B, winner: null });
  });

  it('PoK Mech (Regelentscheidung): Schadensresistenz fängt auch Bombardement-Treffer ab', () => {
    const carrier = unit(T.carrier);
    const ships = units(2, T.battleship);
    const mech = unit(T.mech, BLUE);
    const infantry = unit(T.infantry, BLUE);
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, ...ships] }, enemyWorld([mech, infantry])],
      carrier,
      [],
      ships,
    );
    const targets = ships.map((ship) => ({ unit: ship.id, planet: B }));
    const after = step(state, { type: 'Bombard', issuedBy: RED, targets }, contextWith(HIT));
    expect(after.events[0]).toMatchObject({
      type: 'BombardmentRolled',
      sustained: [mech.id],
      destroyed: [infantry.id],
    });
    expect(unitOn(after.state, B, mech.id)?.damaged).toBe(true);
    expect(unitOn(after.state, B, infantry.id)).toBeUndefined();
  });

  it('RR 87.7 / PoK Mech: auch Abwehrfeuer der Weltraumkanonen trifft zuerst die Schadensresistenz', () => {
    const carrier = unit(T.carrier);
    const mech = unit(T.mech);
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, mech] }, enemyWorld([unit(T.battery, BLUE)])],
      carrier,
      [mech],
      [],
      new ScriptedRandom([1]),
    );
    const after = step(state, land([mech]), contextWith(HIT));
    expect(after.events[1]).toMatchObject({
      type: 'SpaceCannonDefenseFired',
      sustained: [mech.id],
      destroyed: [],
    });
    expect(unitOn(after.state, B, mech.id)?.damaged).toBe(true);
    expect(after.state.planets[B]?.controller).toBe(RED);
  });

  it('RR 73.8 / PoK Mech: beschädigte Mechs werden in der Statusphase repariert', () => {
    const mech = unit(T.mech, RED, true);
    const state = board({ id: 'a', q: 0, planet: [mech] });
    const after = evolveGame(state, { type: 'RoundEnded' });
    expect(unitOn(after, planetOf({ id: 'a', q: 0 }), mech.id)?.damaged).toBe(false);
  });

  it('RR 60 / PoK Mech: ein Mech mit Planetarem Schild der Fraktion verhindert Bombardement', () => {
    const shield: FactionAbility = {
      id: 'shield',
      modifiers: [{ target: { types: [T.mech] }, change: { add: [{ kind: 'planetaryShield' }] } }],
      rules: {},
    };
    const shielded = withAbilities('f-blue', [shield]);
    const state = board(
      { id: 'a', q: 0 },
      { ...enemyWorld([unit(T.mech, BLUE)]), units: [unit(T.battleship)] },
    );
    const catalog = technologyCatalog(state, shielded);
    expect(bombardablePlanets(state, S('b'), RED, catalog)).toEqual([]);
    expect(bombardablePlanets(state, S('b'), RED, technologyCatalog(state, content))).toEqual([B]);
  });
});

/** Content, in dem eine Testfraktion zusätzliche Fähigkeiten hat. */
function withAbilities(faction: string, abilities: readonly FactionAbility[]): ContentPort {
  return {
    ...content,
    factions: FACTIONS.map((f) => (f.id === faction ? { ...f, abilities } : f)),
  };
}

const PLAIN: FactionAbility = { id: 'plain', modifiers: [], rules: {} };
const BEACHHEAD: FactionAbility = {
  ...PLAIN,
  id: 'beachhead',
  deploy: { unit: T.mech, trigger: { kind: 'planetCaptured' } },
};
const BROOD: FactionAbility = {
  ...PLAIN,
  id: 'brood',
  deploy: { unit: T.mech, trigger: { kind: 'groundForcesProduced', minimum: 3 } },
};
const DEPLOYING = withAbilities('f-red', [PLAIN, BEACHHEAD, BROOD]);
const deployContext = (random: RandomPort = HIT): DecisionContext => ({
  random,
  now: 0,
  content: DEPLOYING,
});

const deployed = (events: readonly GameEvent[]) =>
  events.flatMap((event) => (event.type === 'UnitsDeployed' ? [event] : []));

describe('Mechs: Einsatz aus der Verstärkung (PoK Mech)', () => {
  it('PoK Mech: wer einen fremden Planeten übernimmt, setzt einen Mech dorthin ein', () => {
    const carrier = unit(T.carrier);
    const infantry = [unit(T.infantry)];
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, ...infantry] }, enemyWorld([])],
      carrier,
      infantry,
    );
    const after = step(state, land(infantry), deployContext());
    expect(types(after.events)).toEqual([
      'GroundForcesCommitted',
      'PlanetControlGained',
      'UnitsDeployed',
      'TacticalStepReached',
    ]);
    const [event] = deployed(after.events);
    expect(event).toMatchObject({ player: RED, ability: 'beachhead', planet: B });
    expect(event?.units.map((u) => u.type)).toEqual([T.mech]);
    expect(after.state.planets[B]?.units.map((u) => u.type)).toEqual([T.infantry, T.mech]);
    expect(after.state.nextUnitNumber).toBe(state.nextUnitNumber + 1);
    expect(isReversible(after.events)).toBe(true);
  });

  it('PoK Mech: ein Planet ohne Besitzer löst keinen Einsatz aus', () => {
    const carrier = unit(T.carrier);
    const infantry = [unit(T.infantry)];
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, ...infantry] }, enemyWorld([], null)],
      carrier,
      infantry,
    );
    expect(deployed(step(state, land(infantry), deployContext()).events)).toEqual([]);
  });

  it('RR 24.5 / PoK Mech: ohne Mechs im Vorrat gibt es keinen Einsatz', () => {
    const carrier = unit(T.carrier);
    const infantry = [unit(T.infantry)];
    const reserve = { id: 'c', q: 2, planet: units(4, T.mech), planetId: 'c-world' };
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, ...infantry] }, enemyWorld([]), reserve],
      carrier,
      infantry,
    );
    expect(deployed(step(state, land(infantry), deployContext()).events)).toEqual([]);
  });

  it('PoK Mech: eine Einsatzregel für einen unbekannten Einheitentyp setzt nichts ein', () => {
    const carrier = unit(T.carrier);
    const infantry = [unit(T.infantry)];
    const unknown: FactionAbility = {
      ...BEACHHEAD,
      deploy: { unit: unitTypeId('nope'), trigger: { kind: 'planetCaptured' } },
    };
    const context = { ...deployContext(), content: withAbilities('f-red', [unknown]) };
    const state = arrive(
      [{ id: 'a', q: 0, units: [carrier, ...infantry] }, enemyWorld([])],
      carrier,
      infantry,
    );
    expect(deployed(step(state, land(infantry), context).events)).toEqual([]);
  });

  it('PoK Mech: nach mindestens 3 produzierten Bodentruppen kommt ein Mech auf denselben Planeten', () => {
    const state = atDock([], deployContext());
    const after = step(state, produce([{ type: T.infantry, count: 4 }]), deployContext());
    const [event] = deployed(after.events);
    expect(event).toMatchObject({ ability: 'brood', planet: WORLD });
    expect(after.state.planets[WORLD]?.units.filter((u) => u.type === T.mech)).toHaveLength(1);
    expect(after.state.nextUnitNumber).toBe(state.nextUnitNumber + 5);
    expect(after.events.at(-2)?.type).toBe('UnitsDeployed');
  });

  it('PoK Mech: zu wenige Bodentruppen oder nur Schiffe lösen keinen Einsatz aus', () => {
    const state = atDock([], deployContext());
    const few = step(state, produce([{ type: T.infantry, count: 2 }]), deployContext());
    expect(deployed(few.events)).toEqual([]);
    const ships = step(state, produce([{ type: T.cruiser, count: 1 }]), deployContext());
    expect(deployed(ships.events)).toEqual([]);
  });

  it('Reducer: ein Einsatz auf einen unbekannten Planeten zählt nur die Einheiten-Ids weiter', () => {
    const state = board({ id: 'a', q: 0 });
    const after = evolveGame(state, {
      type: 'UnitsDeployed',
      player: RED,
      ability: 'brood',
      planet: planetId('nirgendwo'),
      units: [unit(T.mech)],
    });
    expect(after.planets).toEqual(state.planets);
    expect(after.nextUnitNumber).toBe(state.nextUnitNumber + 1);
  });
});
