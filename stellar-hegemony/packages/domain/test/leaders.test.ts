import { describe, expect, it } from 'vitest';
import {
  commanderAbilities,
  commanderProgress,
  deployEvents,
  evolveGame,
  fleetLimitOf,
  type GameCommand,
  type GameEvent,
  type GameState,
  homePlanetOf,
  isReversible,
  leaderProgress,
  leadersOf,
  leaderUnlockEvents,
  objectiveId,
  planetCaptured,
  planetId,
  type PlanetId,
  type PlayerId,
  playerView,
  rewardListEvents,
  technologyCatalog,
  unlockProgress,
  updatePlayer,
  usableLeaders,
  visibleEvents,
} from '../src/index.ts';
import { BLUE, content, contextWith, LD, RED, T } from './fixtures.ts';
import { actionPhaseGame, startedGame, step } from './game-flow.ts';

const HOME = planetId('red-prime');
const SIX_PLANETS = ['throne', 'alpha-1', 'beta-1', 'beta-2', 'gamma-1'].map(planetId);

const playerOf = (state: GameState, player: PlayerId = RED) =>
  state.players.find((candidate) => candidate.id === player);
const statusOf = (state: GameState, leader: string) =>
  playerOf(state)?.leaders.find((owned) => owned.id === LD(leader))?.status;
const types = (events: readonly GameEvent[]) => events.map((event) => event.type);
const codeOf = (state: GameState, command: GameCommand) => {
  try {
    step(state, command);
    return 'ok';
  } catch (error) {
    return (error as Error).message.split(': ')[1];
  }
};

const useLeader = (leader: string, issuedBy: PlayerId = RED): GameCommand => ({
  type: 'UseLeader',
  issuedBy,
  leader: LD(leader),
});

const control = (state: GameState, planets: readonly PlanetId[], owner = RED): GameState => ({
  ...state,
  planets: {
    ...state.planets,
    ...Object.fromEntries(
      planets.map((id) => [id, { id, controller: owner, exhausted: false, units: [] }]),
    ),
  },
});

const scored = (state: GameState, count: number, player = RED): GameState => ({
  ...state,
  objectives: {
    ...state.objectives,
    scored: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [objectiveId(`o-${String(index)}`), [player]]),
    ),
  },
});

/** Nach einem Zug wieder am Zug, ohne die übrigen Wirkungen zurückzunehmen. */
const again = (after: GameState, before: GameState): GameState => ({
  ...after,
  actionPhase: before.actionPhase,
});

describe('Anführer im Spielaufbau (PoK Anführer)', () => {
  it('PoK Anführer: zum Start erhält jeder seine Anführer; nur der Agent ist bereit', () => {
    const state = startedGame();
    expect(playerOf(state)?.leaders).toEqual([
      { id: LD('scout'), kind: 'agent', status: 'ready' },
      { id: LD('marshal'), kind: 'commander', status: 'locked' },
      { id: LD('warlord'), kind: 'hero', status: 'locked' },
    ]);
    expect(playerOf(state, BLUE)?.leaders).toEqual([]);
    expect(leadersOf(state, RED, content).map((leader) => leader.definition.kind)).toEqual([
      'agent',
      'commander',
      'hero',
    ]);
  });

  it('PoK Anführer: Anführer sind öffentlich, ihre Events werden nicht verdeckt', () => {
    const state = startedGame();
    expect(playerOf(playerView(state, BLUE))?.leaders).toEqual(playerOf(state)?.leaders);
    const events: readonly GameEvent[] = [
      { type: 'LeaderUnlocked', player: RED, leader: LD('marshal') },
      { type: 'LeaderUsed', player: RED, leader: LD('scout'), purged: false },
    ];
    expect(visibleEvents(events, BLUE)).toEqual(events);
  });
});

describe('Agenten (PoK Anführer)', () => {
  const base = actionPhaseGame();

  it('PoK Anführer: der Agent wird erschöpft und in der Statusphase wieder bereit', () => {
    expect(usableLeaders(base, RED, content)).toEqual([LD('scout')]);
    const { state: after, events } = step(base, useLeader('scout'));
    expect(types(events)).toEqual(['LeaderUsed', 'CommoditiesGained', 'TurnEnded']);
    expect(playerOf(after)?.commodities).toBe(1);
    expect(statusOf(after, 'scout')).toBe('exhausted');
    expect(isReversible(events)).toBe(false);
    expect(codeOf(again(after, base), useLeader('scout'))).toBe('leader.exhausted');
    expect(usableLeaders(again(after, base), RED, content)).toEqual([]);
    const refreshed = evolveGame(after, { type: 'RoundEnded' });
    expect(statusOf(refreshed, 'scout')).toBe('ready');
  });

  it('PoK Anführer: ohne Wirkung, außerhalb des eigenen Zugs oder in der Strategiephase nicht', () => {
    const full = updatePlayer(base, RED, (p) => ({ ...p, commodities: p.commodityLimit }));
    expect(codeOf(full, useLeader('scout'))).toBe('leader.noEffect');
    expect(usableLeaders(full, RED, content)).toEqual([]);
    expect(codeOf(base, useLeader('scout', BLUE))).toBe('leader.notAction');
    expect(usableLeaders(base, BLUE, content)).toEqual([]);
    expect(codeOf(startedGame(), useLeader('scout'))).toBe('phase.commandNotAllowed');
  });

  it('PoK Anführer: Kommandanten haben keine Aktion; gesperrte, fremde und entfernte Anführer nicht', () => {
    expect(codeOf(base, useLeader('marshal'))).toBe('leader.noAction');
    expect(codeOf(base, useLeader('unbekannt'))).toBe('leader.noAction');
    expect(codeOf(base, useLeader('warlord'))).toBe('leader.locked');
    const without = updatePlayer(base, RED, (p) => ({ ...p, leaders: [] }));
    expect(codeOf(without, useLeader('scout'))).toBe('leader.notOwned');
    const purged = updatePlayer(base, RED, (p) => ({
      ...p,
      leaders: p.leaders.map((leader) => ({ ...leader, status: 'purged' as const })),
    }));
    expect(codeOf(purged, useLeader('warlord'))).toBe('leader.purged');
  });
});

describe('Kommandanten (PoK Anführer)', () => {
  const base = control(actionPhaseGame(), SIX_PLANETS.slice(0, -1));

  it('PoK Anführer: der Kommandant wird nach dem Command frei, sobald die Bedingung erfüllt ist', () => {
    expect(commanderProgress(base, RED, content)).toEqual({ current: 5, needed: 6 });
    expect(types(step(base, useLeader('scout')).events)).not.toContain('LeaderUnlocked');
    const ready = control(base, SIX_PLANETS);
    const { state: after, events } = step(ready, useLeader('scout'));
    expect(types(events).slice(-2)).toEqual(['LeaderUnlocked', 'FactionAbilitiesGranted']);
    expect(statusOf(after, 'marshal')).toBe('ready');
    expect(commanderProgress(after, RED, content)).toBeNull();
    expect(isReversible(events.slice(-2))).toBe(true);
    expect(leaderUnlockEvents(after, content)).toEqual([]);
  });

  it('PoK Anführer: ein freier Kommandant ändert Flottenlimit, Einheitenwerte und setzt Einheiten ein', () => {
    const before = control(base, SIX_PLANETS);
    const after = step(before, useLeader('scout')).state;
    expect(fleetLimitOf(after, RED, content) - fleetLimitOf(before, RED, content)).toBe(1);
    const cruiser = (state: GameState) => technologyCatalog(state, content).find(T.cruiser, RED);
    expect((cruiser(after)?.move ?? 0) - (cruiser(before)?.move ?? 0)).toBe(1);
    expect(commanderAbilities(before, RED, content)).toEqual([]);
    const input = { state: after, player: RED, planet: planetId('alpha-1'), content };
    const deployed = deployEvents({ ...input, fires: planetCaptured(true) });
    expect(deployed.map((event) => event.ability)).toEqual(['marshal']);
    expect(deployEvents({ ...input, fires: planetCaptured(false) })).toEqual([]);
  });
});

describe('Helden (PoK Anführer)', () => {
  const base = actionPhaseGame();

  it('PoK Anführer: der Held wird mit drei gewerteten Aufträgen frei, wirkt einmal und ist dann aus dem Spiel', () => {
    const two = scored(base, 2);
    expect(leaderUnlockEvents(two, content)).toEqual([]);
    const { state: unlocked, events } = step(scored(base, 3), useLeader('scout'));
    expect(events.at(-1)).toEqual({ type: 'LeaderUnlocked', player: RED, leader: LD('warlord') });
    const ready = again(unlocked, base);
    expect(usableLeaders(ready, RED, content)).toEqual([LD('warlord')]);
    const goods = playerOf(ready)?.tradeGoods ?? 0;
    const { state: after, events: used } = step(ready, useLeader('warlord'));
    expect(types(used)).toEqual(['LeaderUsed', 'UnitsDeployed', 'TradeGoodsGained', 'TurnEnded']);
    expect(statusOf(after, 'warlord')).toBe('purged');
    expect(playerOf(after)?.tradeGoods).toBe(goods + 2);
    expect(after.planets[HOME]?.units.filter((u) => u.type === T.infantry)).toHaveLength(5);
    expect(codeOf(again(after, base), useLeader('warlord'))).toBe('leader.purged');
    const round = evolveGame(after, { type: 'RoundEnded' });
    expect(statusOf(round, 'warlord')).toBe('purged');
  });

  it('PoK Anführer: ohne Heimatplanet wirkt nur der Rest der Heldenaktion', () => {
    const lost = control(scored(base, 3), [HOME], BLUE);
    const ready = again(step(lost, useLeader('scout')).state, base);
    expect(homePlanetOf(ready, RED, content)).toBeNull();
    expect(types(step(ready, useLeader('warlord')).events)).toEqual([
      'LeaderUsed',
      'TradeGoodsGained',
      'TurnEnded',
    ]);
  });
});

describe('Freischaltbedingungen und Belohnungen (PoK Anführer)', () => {
  const base = actionPhaseGame();
  const progress = (state: GameState, condition: Parameters<typeof unlockProgress>[2]) =>
    unlockProgress(state, RED, condition, content).current;

  it('PoK Anführer: jede Bedingungsart zählt ihren Fortschritt', () => {
    const planets = control(base, [planetId('beta-1'), planetId('beta-2'), planetId('throne')]);
    expect(progress(planets, { kind: 'controlPlanets', count: 9 })).toBe(4);
    expect(progress(planets, { kind: 'controlPlanets', count: 9, trait: 'cultural' })).toBe(1);
    expect(progress(planets, { kind: 'controlSpecialPlanets', count: 1 })).toBe(2);
    expect(progress(base, { kind: 'controlSpecialPlanets', count: 1 })).toBe(0);
    const teched = updatePlayer(base, RED, (p) => ({ ...p, technologies: ['a', 'b'] as never }));
    expect(progress(teched, { kind: 'ownTechnologies', count: 3 })).toBe(2);
    expect(progress(base, { kind: 'unitsOnBoard', unit: T.cruiser, count: 3 })).toBe(2);
    expect(progress(scored(base, 2), { kind: 'scoredObjectives', count: 3 })).toBe(2);
    expect(progress(scored(base, 2, BLUE), { kind: 'scoredObjectives', count: 3 })).toBe(0);
  });

  it('PoK Anführer: Fortschritt nur für gesperrte Anführer, unbekannte Spieler haben keine', () => {
    const [agent, commander] = leadersOf(base, RED, content);
    expect(agent && leaderProgress(base, RED, agent, content)).toBeNull();
    expect(commander && leaderProgress(base, RED, commander, content)).toEqual({
      current: 1,
      needed: 6,
    });
    const ghost = 'geist' as PlayerId;
    expect(leadersOf(base, ghost, content)).toEqual([]);
    expect(commanderProgress(base, ghost, content)).toBeNull();
    expect(unlockProgress(base, ghost, { kind: 'ownTechnologies', count: 1 }, content)).toEqual({
      current: 0,
      needed: 1,
    });
    const unknown = updatePlayer(base, RED, (p) => ({
      ...p,
      leaders: [{ id: LD('verschollen'), kind: 'agent', status: 'ready' }],
    }));
    expect(leadersOf(unknown, RED, content)).toEqual([]);
  });

  it('PoK Anführer: mehrere Belohnungen nacheinander, Reliktfragmente als Belohnung', () => {
    const input = {
      state: base,
      player: RED,
      planet: HOME,
      source: 'test',
      content,
      random: contextWith().random,
    };
    const placed = rewardListEvents(input, [
      { kind: 'placeUnits', unit: T.infantry, count: 1 },
      { kind: 'placeUnits', unit: T.infantry, count: 1 },
    ]);
    const ids = placed.flatMap((event) => (event.type === 'UnitsDeployed' ? event.units : []));
    expect(new Set(ids.map((unit) => unit.id)).size).toBe(2);
    const fragments = rewardListEvents(input, [
      { kind: 'gainRelicFragments', fragment: 'frontier', count: 2 },
    ]);
    const after = fragments.reduce(evolveGame, base);
    expect(playerOf(after)?.relicFragments).toEqual(['frontier', 'frontier']);
  });
});
