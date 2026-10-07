import { describe, expect, it } from 'vitest';
import {
  combinedRules,
  type ContentPort,
  excessActionCards,
  type FactionAbility,
  type FactionRules,
  fleetLimitOf,
  type GameCommand,
  type GameState,
  lawVotes,
  NO_FACTION_RULES,
  type PlayerId,
  technologyCatalog,
  updatePlayer,
} from '../src/index.ts';
import { AC, BLUE, CARD, catalog, content, FACTIONS, RED, ScriptedRandom, T } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, setupGame, statusPhaseGame, step } from './game-flow.ts';

const PLATING: FactionAbility = {
  id: 'plating',
  modifiers: [{ target: { types: [T.cruiser] }, change: { hitOn: -1 } }],
  rules: { fleetLimit: 1 },
};
const CHOIR: FactionAbility = {
  id: 'choir',
  modifiers: [],
  rules: { extraVotes: 2, freeSecondaries: ['trade'] },
};

/** Content, in dem nur die blaue Fraktion Fähigkeiten hat. */
const abilityContent: ContentPort = {
  ...content,
  factions: FACTIONS.map((faction) =>
    faction.id === 'f-blue' ? { ...faction, abilities: [PLATING, CHOIR] } : faction,
  ),
};
const abilityContext = () => ({ random: new ScriptedRandom([0]), now: 0, content: abilityContent });

const withRules = (state: GameState, player: PlayerId, rules: Partial<FactionRules>) =>
  updatePlayer(state, player, (p) => ({ ...p, factionRules: { ...NO_FACTION_RULES, ...rules } }));

const playerOf = (state: GameState, id: PlayerId) =>
  state.players.find((player) => player.id === id) as GameState['players'][number];

const endScoring = (issuedBy: PlayerId) => ({ type: 'EndScoring', issuedBy }) as const;

const allocate = (state: GameState, issuedBy: PlayerId, gained: number): GameCommand => {
  const pools = playerOf(state, issuedBy).commandPools;
  return {
    type: 'AllocateCommandTokens',
    issuedBy,
    pools: { ...pools, tactic: pools.tactic + gained },
  };
};

describe('Fraktionsfähigkeiten (RR 27.21)', () => {
  it('RR 27.21: Fähigkeiten gelten ab Spielstart, nur für Fraktionen, die welche haben', () => {
    const { state, events } = step(
      setupGame(),
      { type: 'StartGame', issuedBy: RED },
      abilityContext(),
    );
    const granted = events.filter((event) => event.type === 'FactionAbilitiesGranted');
    expect(granted).toEqual([
      {
        type: 'FactionAbilitiesGranted',
        player: BLUE,
        rules: { ...NO_FACTION_RULES, fleetLimit: 1, extraVotes: 2, freeSecondaries: ['trade'] },
      },
    ]);
    expect(playerOf(state, BLUE).factionRules.extraVotes).toBe(2);
    expect(playerOf(state, RED).factionRules).toEqual(NO_FACTION_RULES);
  });

  it('RR 27.21: mehrere Fähigkeiten addieren ihre Regelwerte', () => {
    const rules = combinedRules([CHOIR, CHOIR, PLATING]);
    expect(rules).toMatchObject({ extraVotes: 4, fleetLimit: 1, statusTradeGoods: 0 });
    expect(rules.freeSecondaries).toEqual(['trade', 'trade']);
    expect(combinedRules([])).toEqual(NO_FACTION_RULES);
  });

  it('RR 27.21: Einheitenwerte der Fraktion wirken wie eine Technologie, nur für sie', () => {
    const state = run(setupGame(), [{ type: 'StartGame', issuedBy: RED }], abilityContext());
    const units = technologyCatalog(state, abilityContent);
    const base = catalog.find(T.cruiser)?.combat?.hitOn ?? 0;
    expect(units.find(T.cruiser, BLUE)?.combat?.hitOn).toBe(base - 1);
    expect(units.find(T.cruiser, RED)?.combat?.hitOn).toBe(base);
  });

  it('RR 28: das Flottenlimit der Fraktion kommt zum Flottenpool hinzu', () => {
    const state = withRules(actionPhaseGame(), BLUE, { fleetLimit: 1 });
    const pool = playerOf(state, BLUE).commandPools.fleet;
    expect(fleetLimitOf(state, BLUE, content)).toBe(pool + 1);
    expect(fleetLimitOf(state, RED, content)).toBe(playerOf(state, RED).commandPools.fleet);
  });

  it('RR 2.6: zusätzliche Stimmen der Fraktion zählen bei jeder Abstimmung', () => {
    const state = withRules(actionPhaseGame(), BLUE, { extraVotes: 2 });
    expect(lawVotes(state, BLUE)).toBe(2);
    expect(lawVotes(state, RED)).toBe(0);
  });

  it('RR 3.4: ein höheres Handkartenlimit erlaubt mehr Aktionskarten', () => {
    const hand = Array.from({ length: 8 }, () => AC('goods'));
    const full = updatePlayer(actionPhaseGame(), BLUE, (p) => ({ ...p, actionCards: hand }));
    expect(excessActionCards(full, BLUE)).toBe(1);
    expect(excessActionCards(withRules(full, BLUE, { actionCardHandLimit: 1 }), BLUE)).toBe(0);
  });

  it('RR 73.3: Einkommen und zusätzliche Aktionskarten in der Statusphase', () => {
    const ended = run(statusPhaseGame(), [endScoring(RED), endScoring(BLUE)]);
    const prepared = withRules(ended, BLUE, { statusTradeGoods: 1, statusActionCards: 1 });
    const { state, events } = step(prepared, endScoring(GREEN));
    expect(events).toContainEqual({ type: 'TradeGoodsGained', player: BLUE, amount: 1 });
    expect(playerOf(state, BLUE).tradeGoods).toBe(playerOf(prepared, BLUE).tradeGoods + 1);
    expect(state.players.map((player) => player.actionCards.length)).toEqual([1, 2, 1]);
  });

  it('RR 73.5: zusätzliche Kommandomarker in der Statusphase', () => {
    const ended = run(statusPhaseGame(), [endScoring(RED), endScoring(BLUE), endScoring(GREEN)]);
    const prepared = withRules(run(ended, [allocate(ended, RED, 2)]), BLUE, {
      statusCommandTokens: 1,
    });
    expect(() => run(prepared, [allocate(prepared, BLUE, 2)])).toThrow('totalChanged');
    const after = run(prepared, [allocate(prepared, BLUE, 3)]);
    expect(playerOf(after, BLUE).reinforcementTokens).toBe(
      playerOf(prepared, BLUE).reinforcementTokens - 3,
    );
  });

  it('RR 34.4: eine Fraktion kann Sekundärfähigkeiten ohne Strategiemarker nutzen', () => {
    const game = actionPhaseGame();
    const card = game.strategyCards[CARD(5)] as GameState['strategyCards'][string];
    const holding = {
      ...withRules(game, BLUE, { freeSecondaries: ['trade'] }),
      strategyCards: { ...game.strategyCards, [card.id]: { ...card, holder: RED } },
    };
    const choice = { mechanic: 'trade', freeFor: [] } as const;
    const acted = run(holding, [
      { type: 'PerformStrategicAction', issuedBy: RED, card: CARD(5), choice },
    ]);
    const { events } = step(acted, { type: 'ResolveSecondary', issuedBy: BLUE, choice });
    expect(events[0]).toEqual({
      type: 'SecondaryResolved',
      player: BLUE,
      paidStrategyToken: false,
    });
  });
});
