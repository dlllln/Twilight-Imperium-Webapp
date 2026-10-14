import { describe, expect, it } from 'vitest';
import {
  evolveGame,
  type FragmentKind,
  fleetLimitOf,
  type GameCommand,
  type GameEvent,
  type GameState,
  exploreFrontierEvents,
  HIDDEN,
  isReversible,
  NO_PILES,
  planetId,
  type PlayerId,
  passiveRelics,
  playerView,
  purgeOptions,
  rewardEvents,
  rewardUsable,
  systemId,
  technologyCatalog,
  updatePlayer,
  usableLegendaryPlanets,
  usableRelics,
  visibleEvents,
} from '../src/index.ts';
import { BLUE, content, contextWith, RED, RL, T, unit, units, XC } from './fixtures.ts';
import { actionPhaseGame, step } from './game-flow.ts';

const PLAIN = planetId('beta-2');
const ALPHA = planetId('alpha-1');

const playerOf = (state: GameState, player: PlayerId = RED) =>
  state.players.find((candidate) => candidate.id === player);
const types = (events: readonly GameEvent[]) => events.map((event) => event.type);
const codeOf = (state: GameState, command: GameCommand) => {
  try {
    step(state, command);
    return 'ok';
  } catch (error) {
    return (error as Error).message.split(': ')[1];
  }
};

const holding = (
  state: GameState,
  fragments: readonly FragmentKind[],
  relics: readonly string[] = [],
): GameState =>
  updatePlayer(state, RED, (p) => ({
    ...p,
    relicFragments: fragments,
    relics: relics.map((id) => ({ id: RL(id), exhausted: false })),
  }));

const withRelicDeck = (state: GameState, relics: readonly string[]): GameState => ({
  ...state,
  exploration: { ...state.exploration, relicDeck: relics.map(RL) },
});

const purge = (fragments: readonly FragmentKind[]): GameCommand => ({
  type: 'PurgeRelicFragments',
  issuedBy: RED,
  fragments,
});

const useRelic = (relic: string): GameCommand => ({
  type: 'UseRelic',
  issuedBy: RED,
  relic: RL(relic),
});

describe('Reliktfragmente eintauschen (PoK Relikt)', () => {
  const base = withRelicDeck(actionPhaseGame(), ['crown', 'core', 'prism']);

  it('PoK Relikt: drei Fragmente einer Art (Grenze als Joker) ergeben das oberste Relikt; der Zug endet', () => {
    const state = holding(base, ['industrial', 'cultural', 'industrial', 'frontier']);
    const { state: after, events } = step(state, purge(['industrial', 'industrial', 'frontier']));
    expect(types(events)).toEqual([
      'RelicFragmentsPurged',
      'RelicDrawn',
      'VictoryPointsGained',
      'TurnEnded',
    ]);
    expect(playerOf(after)?.relicFragments).toEqual(['cultural']);
    expect(playerOf(after)?.relics).toEqual([{ id: RL('crown'), exhausted: false }]);
    expect(playerOf(after)?.victoryPoints).toBe(1);
    expect(after.exploration.relicDeck).toEqual([RL('core'), RL('prism')]);
    expect(isReversible(events)).toBe(false);
  });

  it('PoK Relikt: Wirkung beim Erhalt füllt den Taktikpool nur aus dem Nachschub', () => {
    const state = holding(withRelicDeck(base, ['core']), ['hazardous', 'hazardous', 'hazardous']);
    const scarce = updatePlayer(state, RED, (p) => ({ ...p, reinforcementTokens: 1 }));
    const { events } = step(scarce, purge(['hazardous', 'hazardous', 'hazardous']));
    expect(events).toContainEqual({
      type: 'CommandTokensGained',
      player: RED,
      pools: { tactic: 1, fleet: 0, strategy: 0 },
    });
  });

  it('PoK Relikt: falsche Gruppen, fehlende Fragmente, leerer Stapel und fremder Zug werden abgelehnt', () => {
    const state = holding(base, ['industrial', 'industrial', 'cultural']);
    expect(codeOf(state, purge(['industrial', 'industrial', 'cultural']))).toBe(
      'relic.invalidFragments',
    );
    expect(codeOf(state, purge(['industrial', 'industrial']))).toBe('relic.invalidFragments');
    expect(codeOf(state, purge(['industrial', 'industrial', 'industrial']))).toBe(
      'relic.fragmentsMissing',
    );
    const ready = holding(withRelicDeck(base, []), ['cultural', 'cultural', 'cultural']);
    expect(codeOf(ready, purge(['cultural', 'cultural', 'cultural']))).toBe('relic.deckEmpty');
    const blue = { ...purge(['cultural']), issuedBy: BLUE };
    expect(codeOf(ready, blue)).toBe('exploration.notAction');
  });

  it('PoK Relikt: mögliche Dreiergruppen je Art, Grenzfragmente füllen auf', () => {
    const state = holding(base, ['cultural', 'frontier', 'frontier', 'hazardous']);
    expect(purgeOptions(state, RED)).toEqual([
      ['cultural', 'frontier', 'frontier'],
      ['hazardous', 'frontier', 'frontier'],
    ]);
    expect(purgeOptions(holding(base, ['frontier', 'frontier', 'frontier']), RED)).toEqual([
      ['frontier', 'frontier', 'frontier'],
    ]);
    expect(purgeOptions(base, BLUE)).toEqual([]);
  });
});

describe('Relikte nutzen (PoK Relikt)', () => {
  const base = actionPhaseGame();

  it('PoK Relikt: dauerhafte Relikte erhöhen Flottenlimit und Kampfwerte', () => {
    const state = holding(base, [], ['banner']);
    expect(fleetLimitOf(state, RED, content) - fleetLimitOf(base, RED, content)).toBe(1);
    const infantry = technologyCatalog(state, content).find(T.infantry, RED);
    expect(infantry?.combat?.hitOn).toBe(7);
  });

  it('PoK Relikt: ein erschöpfbares Relikt wirkt einmal je Runde und wird in der Statusphase bereit', () => {
    const state = holding(base, [], ['prism']);
    expect(usableRelics(state, RED, content)).toEqual([RL('prism')]);
    const { state: after, events } = step(state, useRelic('prism'));
    expect(types(events)).toEqual(['RelicUsed', 'TradeGoodsGained', 'TurnEnded']);
    expect(playerOf(after)?.relics).toEqual([{ id: RL('prism'), exhausted: true }]);
    const again = { ...after, actionPhase: state.actionPhase };
    expect(codeOf(again, useRelic('prism'))).toBe('relic.exhausted');
    expect(usableRelics(again, RED, content)).toEqual([]);
    const refreshed = evolveGame(after, { type: 'RoundEnded' });
    expect(playerOf(refreshed)?.relics[0]?.exhausted).toBe(false);
  });

  it('PoK Relikt: ein Relikt zum Abwerfen macht alle Planeten bereit und ist danach weg', () => {
    const state = holding(base, [], ['capsule']);
    expect(codeOf(state, useRelic('capsule'))).toBe('exploration.noEffect');
    const tired = {
      ...state,
      planets: Object.fromEntries(
        Object.entries(state.planets).map(([id, p]) => [
          id,
          { ...p, exhausted: p.controller === RED },
        ]),
      ),
    };
    const { state: after, events } = step(tired, useRelic('capsule'));
    expect(types(events)).toContain('PlanetsReadied');
    expect(playerOf(after)?.relics).toEqual([]);
  });

  it('PoK Relikt: nur gehaltene Relikte mit Aktion', () => {
    expect(codeOf(base, useRelic('prism'))).toBe('relic.notOwned');
    expect(codeOf(holding(base, [], ['crown']), useRelic('crown'))).toBe('relic.noAction');
    expect(codeOf(base, useRelic('unbekannt'))).toBe('relic.noAction');
    expect(usableRelics(holding(base, [], ['crown']), RED, content)).toEqual([]);
    expect(usableRelics(holding(base, [], ['prism']), BLUE, content)).toEqual([]);
  });

  it('PoK Relikt: Relikte und Fragmente sind offen, Stapel bleiben verdeckt', () => {
    const state = holding(withRelicDeck(base, ['crown']), ['cultural'], ['prism']);
    const view = playerView(state, BLUE);
    expect(playerOf(view)?.relics).toEqual([{ id: RL('prism'), exhausted: false }]);
    expect(playerOf(view)?.relicFragments).toEqual(['cultural']);
    expect(view.exploration.relicDeck).toEqual([HIDDEN]);
    expect(
      Object.values(view.exploration.decks)
        .flat()
        .every((id) => id === HIDDEN),
    ).toBe(true);
    const events: readonly GameEvent[] = [
      {
        type: 'ExplorationPrepared',
        decks: { cultural: [XC('a')], hazardous: [], industrial: [], frontier: [] },
        relicDeck: [RL('crown')],
        frontierTokens: [],
      },
      { type: 'ExplorationDeckReshuffled', deck: 'cultural', cards: [XC('a')] },
      { type: 'PlanetExplored', player: RED, planet: ALPHA, deck: 'industrial', card: XC('a') },
      { type: 'RelicDrawn', player: RED, relic: RL('crown') },
    ];
    const seen = visibleEvents(events, BLUE);
    expect(seen[0]).toMatchObject({ decks: { cultural: [HIDDEN] }, relicDeck: [HIDDEN] });
    expect(seen[1]).toMatchObject({ cards: [HIDDEN] });
    expect(seen.slice(2)).toEqual(events.slice(2));
  });
});

const legendary = (issuedBy: PlayerId = RED, planet = PLAIN): GameCommand => ({
  type: 'UseLegendaryAbility',
  issuedBy,
  planet,
});

describe('Legendäre Planeten (PoK Legendäre Planeten)', () => {
  const owned = (state: GameState, owner: PlayerId | null = RED): GameState => ({
    ...state,
    planets: {
      ...state.planets,
      [PLAIN]: { id: PLAIN, controller: owner, exhausted: true, units: [] },
    },
  });
  const base = owned(actionPhaseGame());

  it('PoK Legendäre Planeten: Fähigkeit als Komponentenaktion, auch bei erschöpftem Planeten, einmal je Runde', () => {
    expect(usableLegendaryPlanets(base, RED, content)).toEqual([PLAIN]);
    const { state, events } = step(base, legendary());
    expect(types(events)).toEqual(['LegendaryAbilityUsed', 'UnitsDeployed', 'TurnEnded']);
    expect(state.planets[PLAIN]?.units).toHaveLength(2);
    const again = { ...state, actionPhase: base.actionPhase };
    expect(codeOf(again, legendary())).toBe('legendary.exhausted');
    expect(usableLegendaryPlanets(again, RED, content)).toEqual([]);
    const refreshed = evolveGame(state, { type: 'RoundEnded' });
    expect(refreshed.exploration.exhaustedLegendaries).toEqual([]);
  });

  it('PoK Legendäre Planeten: nur der Besitzer, nur legendäre Planeten, nur mit Wirkung', () => {
    expect(codeOf(owned(base, BLUE), legendary())).toBe('legendary.notControlled');
    expect(codeOf(base, legendary(RED, ALPHA))).toBe('legendary.unknown');
    expect(usableLegendaryPlanets(base, BLUE, content)).toEqual([]);
  });
});

describe('Belohnungen ohne Wahl (PoK Erkundung)', () => {
  const state = actionPhaseGame();
  const input = (planet: typeof PLAIN | null = PLAIN) => ({
    state,
    player: RED,
    planet,
    source: 'test',
    content,
    random: contextWith().random,
  });

  it('PoK Erkundung: ohne Planet, Vorrat, Raum oder Ziel wirkt eine Belohnung nicht', () => {
    const place = { kind: 'placeUnits', unit: T.infantry, count: 1 } as const;
    expect(rewardUsable(input(null), place)).toBe(false);
    expect(rewardUsable(input(), { ...place, unit: T.mech })).toBe(true);
    const mechs = {
      ...state,
      planets: {
        ...state.planets,
        [PLAIN]: { id: PLAIN, controller: RED, exhausted: false, units: units(4, T.mech) },
      },
    };
    expect(rewardUsable({ ...input(), state: mechs }, { ...place, unit: T.mech })).toBe(false);
    expect(rewardUsable(input(), { ...place, unit: T.carrier })).toBe(true);
    expect(rewardUsable(input(), { kind: 'placeUnits', unit: 'nichts' as never, count: 1 })).toBe(
      false,
    );
    const full = updatePlayer(state, RED, (p) => ({
      ...p,
      commodities: p.commodityLimit,
      reinforcementTokens: 0,
    }));
    expect(rewardUsable({ ...input(), state: full }, { kind: 'gainCommodities', amount: 1 })).toBe(
      false,
    );
    expect(
      rewardUsable({ ...input(), state: full }, { kind: 'gainCommandTokens', amount: 1 }),
    ).toBe(false);
    expect(rewardUsable(input(), { kind: 'repairUnits' })).toBe(false);
    expect(rewardEvents(input(), { kind: 'readyPlanets' })).toEqual([]);
  });

  it('PoK Erkundung: Aktionskarten ziehen und Reparieren als Belohnung', () => {
    expect(types(rewardEvents(input(), { kind: 'drawActionCards', count: 1 }))).toEqual([
      'ActionCardsDrawn',
    ]);
    const damaged = {
      ...state,
      planets: {
        ...state.planets,
        [PLAIN]: { id: PLAIN, controller: RED, exhausted: false, units: [unit(T.mech, RED, true)] },
      },
    };
    expect(rewardEvents({ ...input(), state: damaged }, { kind: 'repairUnits' })).toEqual([
      { type: 'UnitsRepaired', player: RED },
    ]);
  });
});

describe('Unbekannte Verweise und Randfälle (PoK Erkundung)', () => {
  const base = actionPhaseGame();
  const ghost = 'geist' as PlayerId;

  it('PoK Erkundung: unbekannte Spieler halten nichts und erhalten nichts', () => {
    expect(purgeOptions(base, ghost)).toEqual([]);
    expect(passiveRelics(base, ghost, content)).toEqual([]);
    const input = { state: base, player: ghost, planet: null, source: 'x', content };
    expect(rewardUsable(input, { kind: 'gainCommodities', amount: 1 })).toBe(false);
    expect(rewardUsable(input, { kind: 'gainCommandTokens', amount: 1 })).toBe(false);
    const empty = { ...base, exploration: { ...base.exploration, decks: NO_PILES } };
    expect(exploreFrontierEvents(empty, RED, systemId('b'), contextWith())).toEqual([]);
  });

  it('PoK Erkundung: Anlagen auf unbekannten Planeten ändern nichts', () => {
    const attachment = { card: XC('ore'), resources: 1, influence: 0 };
    const nowhere = planetId('nirgendwo');
    const after = evolveGame(base, { type: 'AttachmentAdded', planet: nowhere, attachment });
    expect(after.planets).toEqual(base.planets);
  });

  it('PoK Relikt: ein Relikt ohne Wirkung beim Erhalt; andere Relikte bleiben beim Erschöpfen bereit', () => {
    const state = holding(
      withRelicDeck(base, ['prism']),
      ['industrial', 'industrial', 'industrial'],
      ['crown'],
    );
    const { state: after, events } = step(state, purge(['industrial', 'industrial', 'industrial']));
    expect(types(events)).toEqual(['RelicFragmentsPurged', 'RelicDrawn', 'TurnEnded']);
    const ready = { ...after, actionPhase: state.actionPhase };
    const used = step(ready, useRelic('prism')).state;
    expect(playerOf(used)?.relics).toEqual([
      { id: RL('crown'), exhausted: false },
      { id: RL('prism'), exhausted: true },
    ]);
  });
});
