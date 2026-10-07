import { describe, expect, it } from 'vitest';
import {
  type GameCommand,
  type GameState,
  performStrategicActionHandler,
  planetId,
  type PlayerId,
  type PoolCounts,
  type ProductionRequest,
  resolveSecondaryHandler,
  type StrategyChoice,
  type StructurePlacement,
  type SystemId,
  systemId,
  unitTypeId,
  updatePlayer,
} from '../src/index.ts';
import { BLUE, CARD, content, contextWith, RED, T, unit } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, step } from './game-flow.ts';

const RED_PRIME = planetId('red-prime');
const BLUE_PRIME = planetId('blue-prime');

/** Rot hält zusätzlich die Karte mit der angegebenen Initiative und ist am Zug. */
function holding(initiative: number, state = actionPhaseGame()): GameState {
  const card = state.strategyCards[CARD(initiative)];
  if (card === undefined) throw new Error('Karte fehlt');
  return {
    ...state,
    strategyCards: { ...state.strategyCards, [card.id]: { ...card, holder: RED } },
  };
}

const homeOf = (state: GameState, color: string): SystemId => {
  const home = Object.values(state.systems).find((system) =>
    system.planetIds.includes(planetId(`${color}-prime`)),
  );
  if (home === undefined) throw new Error('Heimat fehlt');
  return home.id;
};

const playerOf = (state: GameState, id: PlayerId) => state.players.find((p) => p.id === id);

const act = (initiative: number, choice: StrategyChoice) =>
  ({ type: 'PerformStrategicAction', issuedBy: RED, card: CARD(initiative), choice }) as const;

const resolve = (issuedBy: PlayerId, choice: StrategyChoice) =>
  ({ type: 'ResolveSecondary', issuedBy, choice }) as const;

const codeOf = (state: GameState, command: GameCommand) => {
  const result =
    command.type === 'PerformStrategicAction'
      ? performStrategicActionHandler.decide(state, command, contextWith())
      : resolveSecondaryHandler.decide(state, command as never, contextWith());
  return result.ok ? 'ok' : result.error.code;
};

const place = (type: StructurePlacement['type'], planet = RED_PRIME) => ({ type, planet });

const construction = (placements: readonly StructurePlacement[], system: SystemId | null = null) =>
  ({ mechanic: 'construction', placements, system }) as const;

describe('Infrastruktur (RR 39)', () => {
  it('RR 39.2: ein Gebäude und ein zusätzliches mit Weltraumkanone auf eigenen Planeten', () => {
    const state = actionPhaseGame();
    const batteries = [place(T.battery), place(T.battery)];
    const { state: after, events } = step(state, act(4, construction(batteries)));
    expect(events.map((event) => event.type)).toEqual([
      'StrategicActionPerformed',
      'StructuresPlaced',
    ]);
    const types = after.planets[RED_PRIME]?.units.map((u) => u.type);
    expect(types?.filter((type) => type === T.battery)).toHaveLength(2);
    expect(after.nextUnitNumber).toBe(state.nextUnitNumber + 2);
  });

  it('RR 39.2: Anzahl, Art und Platz der Gebäude werden geprüft', () => {
    const state = actionPhaseGame();
    const tryBuild = (placements: readonly StructurePlacement[]) =>
      codeOf(state, act(4, construction(placements)));
    expect(tryBuild([])).toBe('construction.count');
    expect(tryBuild([place(T.battery), place(T.battery), place(T.battery)])).toBe(
      'construction.count',
    );
    expect(tryBuild([place(T.battery), place(T.dock)])).toBe('construction.secondCannon');
    expect(tryBuild([place(T.infantry)])).toBe('construction.notStructure');
    expect(tryBuild([place(T.battery, BLUE_PRIME)])).toBe('construction.notYourPlanet');
    expect(tryBuild([place(T.dock)])).toBe('construction.planetFull');
    const fortified = {
      ...state,
      planets: {
        ...state.planets,
        [RED_PRIME]: {
          ...(state.planets[RED_PRIME] as GameState['planets'][string]),
          units: [unit(T.battery)],
        },
      },
    };
    expect(codeOf(fortified, act(4, construction([place(T.battery), place(T.battery)])))).toBe(
      'construction.planetFull',
    );
  });

  it('RR 27.11: ohne eigenen Planeten bleibt Bauen ohne Wirkung, die Karte ist genutzt', () => {
    const state = actionPhaseGame();
    const planets = Object.fromEntries(
      Object.entries(state.planets).map(([id, planet]) => [
        id,
        planet.controller === RED ? { ...planet, controller: null } : planet,
      ]),
    );
    const { state: after, events } = step({ ...state, planets }, act(4, construction([])));
    expect(events.map((event) => event.type)).toEqual([
      'StrategicActionPerformed',
      'StructuresPlaced',
    ]);
    expect(after.strategyCards[CARD(4)]?.exhausted).toBe(true);
  });

  it('RR 27.11: passt kein Gebäude mehr auf eigene Planeten, bleibt Bauen ohne Wirkung', () => {
    const state = actionPhaseGame();
    const full = {
      ...state,
      planets: {
        ...state.planets,
        [RED_PRIME]: {
          ...(state.planets[RED_PRIME] as GameState['planets'][string]),
          units: [unit(T.dock), unit(T.battery), unit(T.battery)],
        },
      },
    };
    expect(codeOf(full, act(4, construction([])))).toBe('ok');
    expect(codeOf(state, act(4, construction([])))).toBe('construction.count');
  });

  it('RR 39.4: Sekundär ein Gebäude im System, dorthin ein Marker aus dem Nachschub', () => {
    const acted = run(actionPhaseGame(), [act(4, construction([place(T.battery)]))]);
    const home = homeOf(acted, 'blue');
    const blue = playerOf(acted, BLUE);
    const choice = construction([place(T.battery, BLUE_PRIME)], home);
    const { state, events } = step(acted, resolve(BLUE, choice));
    expect(events.map((event) => event.type).slice(0, 3)).toEqual([
      'SecondaryResolved',
      'CommandTokensPlaced',
      'StructuresPlaced',
    ]);
    expect(state.systems[home]?.commandTokens).toContain(BLUE);
    expect(playerOf(state, BLUE)?.reinforcementTokens).toBe((blue?.reinforcementTokens ?? 0) - 1);
    expect(playerOf(state, BLUE)?.commandPools.strategy).toBe(
      (blue?.commandPools.strategy ?? 0) - 1,
    );
  });

  it('RR 39.4: falsches System, vorhandener Marker oder leerer Nachschub verhindern das Bauen', () => {
    const acted = run(actionPhaseGame(), [act(4, construction([place(T.battery)]))]);
    const home = homeOf(acted, 'blue');
    const build = (state: GameState, system: SystemId | null, count = 1) =>
      codeOf(
        state,
        resolve(BLUE, construction(Array(count).fill(place(T.battery, BLUE_PRIME)), system)),
      );
    expect(build(acted, homeOf(acted, 'red'))).toBe('construction.wrongSystem');
    expect(build(acted, null)).toBe('construction.wrongSystem');
    expect(build(acted, home, 2)).toBe('construction.count');
    const system = acted.systems[home] as GameState['systems'][string];
    const marked = {
      ...acted,
      systems: { ...acted.systems, [home]: { ...system, commandTokens: [BLUE] } },
    };
    expect(build(marked, home)).toBe('construction.tokenPresent');
    const empty = updatePlayer(acted, BLUE, (p) => ({ ...p, reinforcementTokens: 0 }));
    expect(build(empty, home)).toBe('construction.noReinforcements');
  });
});

const trade = (freeFor: readonly PlayerId[] = []) => ({ mechanic: 'trade', freeFor }) as const;

describe('Handel (RR 34)', () => {
  it('RR 34.2/34.3: drei Handelswaren und Rohstoffe bis zum Limit', () => {
    const state = updatePlayer(holding(5), RED, (p) => ({ ...p, commodities: 0, tradeGoods: 1 }));
    const after = step(state, act(5, trade())).state;
    expect(playerOf(after, RED)).toMatchObject({ tradeGoods: 4, commodities: 3 });
    expect(after.actionPhase?.secondary).toMatchObject({ awaiting: [BLUE, GREEN], free: [] });
  });

  it('RR 34.4: gewählte Mitspieler nutzen die Sekundärfähigkeit ohne Strategiemarker', () => {
    const acted = run(holding(5), [act(5, trade([GREEN]))]);
    expect(acted.actionPhase?.secondary?.free).toEqual([GREEN]);
    const afterBlue = step(acted, resolve(BLUE, trade()));
    expect(afterBlue.events[0]).toEqual({
      type: 'SecondaryResolved',
      player: BLUE,
      paidStrategyToken: true,
    });
    const strategyBefore = playerOf(afterBlue.state, GREEN)?.commandPools.strategy;
    const afterGreen = step(afterBlue.state, resolve(GREEN, trade()));
    expect(afterGreen.events.slice(0, 2)).toEqual([
      { type: 'SecondaryResolved', player: GREEN, paidStrategyToken: false },
      { type: 'CommoditiesReplenished', player: GREEN },
    ]);
    expect(playerOf(afterGreen.state, GREEN)?.commandPools.strategy).toBe(strategyBefore);
  });

  it('RR 34.4: nur andere Spieler, jeder höchstens einmal', () => {
    const state = holding(5);
    expect(codeOf(state, act(5, trade([RED])))).toBe('trade.invalidPlayer');
    expect(codeOf(state, act(5, trade([BLUE, BLUE])))).toBe('trade.invalidPlayer');
    expect(codeOf(state, act(5, construction([])))).toBe('strategy.choiceMismatch');
  });
});

const warfare = (
  system: SystemId | null,
  pools: PoolCounts,
  production: ProductionRequest | null = null,
) => ({ mechanic: 'warfare', system, pools, production }) as const;

/** Rot hält Kriegsführung und hat einen Marker in seinem Heimatsystem liegen. */
function warfareGame(): GameState {
  const state = holding(6);
  const home = homeOf(state, 'red');
  const system = state.systems[home] as GameState['systems'][string];
  return { ...state, systems: { ...state.systems, [home]: { ...system, commandTokens: [RED] } } };
}

describe('Kriegsführung (RR 49)', () => {
  it('RR 49.1/49.2: ein Marker vom Spielplan kommt auf die Tafel, dann wird umverteilt', () => {
    const state = warfareGame();
    const home = homeOf(state, 'red');
    const { tactic, fleet, strategy } = playerOf(state, RED)?.commandPools as PoolCounts;
    const pools = { tactic: tactic - 1, fleet: fleet + 2, strategy };
    const after = step(state, act(6, warfare(home, pools))).state;
    expect(after.systems[home]?.commandTokens).toEqual([]);
    expect(playerOf(after, RED)?.commandPools).toEqual(pools);
    expect(playerOf(after, RED)?.reinforcementTokens).toBe(
      playerOf(state, RED)?.reinforcementTokens,
    );
  });

  it('RR 49.1/49.2: ohne eigenen Marker keine Primärfähigkeit; die Summe muss stimmen', () => {
    const state = warfareGame();
    const pools = playerOf(state, RED)?.commandPools as PoolCounts;
    expect(codeOf(state, act(6, warfare(null, pools)))).toBe('warfare.noToken');
    expect(codeOf(state, act(6, warfare(homeOf(state, 'blue'), pools)))).toBe('warfare.noToken');
    expect(codeOf(state, act(6, warfare(homeOf(state, 'red'), pools)))).toBe(
      'commandSheet.totalChanged',
    );
  });

  it('RR 27.11: ohne eigenen Marker auf dem Plan wird nur umverteilt', () => {
    const state = holding(6);
    const { tactic, fleet, strategy } = playerOf(state, RED)?.commandPools as PoolCounts;
    const pools = { tactic: tactic - 1, fleet: fleet + 1, strategy };
    const { state: after, events } = step(state, act(6, warfare(null, pools)));
    expect(events.map((event) => event.type)).toEqual([
      'StrategicActionPerformed',
      'CommandTokensRedistributed',
    ]);
    expect(playerOf(after, RED)?.commandPools).toEqual(pools);
  });

  it('RR 49.3: Sekundär produziert im eigenen Heimatsystem', () => {
    const state = warfareGame();
    const home = homeOf(state, 'red');
    const pools = { ...(playerOf(state, RED)?.commandPools as PoolCounts) };
    const acted = run(state, [act(6, warfare(home, { ...pools, tactic: pools.tactic + 1 }))]);
    const rich = updatePlayer(acted, BLUE, (p) => ({ ...p, tradeGoods: 1 }));
    const production: ProductionRequest = {
      orders: [{ type: T.fighter, count: 2 }],
      payment: { planets: [], tradeGoods: 1 },
      groundPlanet: null,
    };
    expect(codeOf(rich, resolve(BLUE, warfare(null, pools)))).toBe('warfare.noProduction');
    const { state: after, events } = step(rich, resolve(BLUE, warfare(null, pools, production)));
    expect(events).toContainEqual(expect.objectContaining({ type: 'UnitsProduced', player: BLUE }));
    const blueHome = after.systems[homeOf(after, 'blue')];
    expect(blueHome?.spaceUnits.filter((u) => u.type === T.fighter)).toHaveLength(4);
    expect(playerOf(after, BLUE)?.tradeGoods).toBe(0);
  });
});

describe('fehlende Stammdaten', () => {
  const bare = {
    ...contextWith(),
    content: {
      ...content,
      strategyCards: content.strategyCards.map((card) => ({ ...card, parameters: {} })),
    },
  };
  const decide = (state: GameState, initiative: number, choice: StrategyChoice) =>
    performStrategicActionHandler.decide(state, act(initiative, choice), bare);

  it('ohne Parameter baut Infrastruktur ein Gebäude und Handel bringt keine Handelswaren', () => {
    expect(
      decide(actionPhaseGame(), 4, construction([place(T.battery), place(T.battery)])),
    ).toMatchObject({
      error: { code: 'construction.count' },
    });
    const traded = decide(holding(5), 5, trade());
    expect(traded.ok && traded.value).toContainEqual({
      type: 'TradeGoodsGained',
      player: RED,
      amount: 0,
    });
  });

  it('unbekannte Gebäudetypen, Planeten, Systeme und Fraktionen', () => {
    const state = actionPhaseGame();
    const unknownType = place(unitTypeId('nix'));
    expect(codeOf(state, act(4, construction([unknownType])))).toBe('construction.notStructure');
    expect(codeOf(state, act(4, construction([place(T.battery, planetId('nirgendwo'))])))).toBe(
      'construction.notYourPlanet',
    );
    const war = warfareGame();
    const pools = playerOf(war, RED)?.commandPools as PoolCounts;
    expect(codeOf(war, act(6, warfare(systemId('nirgendwo'), pools)))).toBe('warfare.noToken');
    const acted = run(war, [
      act(6, warfare(homeOf(war, 'red'), { ...pools, tactic: pools.tactic + 1 })),
    ]);
    const stateless = {
      ...acted,
      players: acted.players.map((p) => (p.id === BLUE ? { ...p, faction: 'nix' as never } : p)),
    };
    const production = { orders: [], payment: { planets: [], tradeGoods: 0 }, groundPlanet: null };
    expect(codeOf(stateless, resolve(BLUE, warfare(null, pools, production)))).toBe(
      'warfare.noProduction',
    );
  });
});
