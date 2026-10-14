import { describe, expect, it } from 'vitest';
import {
  canExploreFrontier,
  currentPlanetDefinition,
  evaluatePayment,
  type ExplorationDeckKind,
  type GameEvent,
  type GameState,
  isReversible,
  NO_PILES,
  ownPlanets,
  type PlanetAttachment,
  planetId,
  type PlayerId,
  productionSites,
  researchEvents,
  systemId,
  technologyId,
  type Unit,
  updatePlayer,
  votingPower,
  withAttachments,
} from '../src/index.ts';
import { activate, board, moves, order, S, type Spec } from './board.ts';
import { BLUE, content, contextWith, RED, ScriptedRandom, T, unit, units, XC } from './fixtures.ts';
import { run, startedGame, step } from './game-flow.ts';

const MISS = new ScriptedRandom([10]);
const ALPHA = planetId('alpha-1');
const BETA = planetId('beta-1');
const DELTA = planetId('delta-1');

type Piles = Partial<Record<ExplorationDeckKind, readonly string[]>>;

const piles = (cards: Piles) => ({
  ...NO_PILES,
  ...Object.fromEntries(Object.entries(cards).map(([deck, ids]) => [deck, ids.map(XC)])),
});

/** Legt Stapel und Ablagen fest, damit die gezogene Karte bekannt ist. */
const withDecks = (state: GameState, decks: Piles, discards: Piles = {}): GameState => ({
  ...state,
  exploration: { ...state.exploration, decks: piles(decks), discards: piles(discards) },
});

const types = (events: readonly GameEvent[]) => events.map((event) => event.type);
const playerOf = (state: GameState, player: PlayerId = RED) =>
  state.players.find((candidate) => candidate.id === player);
const codeOf = (state: GameState, command: Parameters<typeof step>[1]) => {
  try {
    step(state, command, contextWith(MISS));
    return 'ok';
  } catch (error) {
    return (error as Error).message.split(': ')[1];
  }
};

/** Rot landet mit zwei Infanterie auf dem Planeten in `b`. */
function invade(planet: string, decks: Piles, discards: Piles = {}, controller = null as never) {
  const carrier = unit(T.carrier);
  const cargo = units(2, T.infantry);
  const specs: readonly Spec[] = [
    { id: 'a', q: 0, units: [carrier, ...cargo] },
    { id: 'b', q: 1, planet: [], planetController: controller, planetId: planet },
  ];
  const start = withDecks(board(...specs), decks, discards);
  const arrived = run(
    start,
    [activate('b'), moves(order(carrier, ['b'], cargo))],
    contextWith(MISS),
  );
  const landings = cargo.map((entry) => ({ unit: entry.id, planet: planetId(planet) }));
  const command = { type: 'CommitGroundForces', issuedBy: RED, landings, centerPayment: null };
  return step(arrived, command as never, contextWith(MISS));
}

describe('Erkundung beim Übernehmen von Planeten (PoK Erkundung)', () => {
  it('PoK Erkundung: Spielaufbau mischt je Eigenschaft einen Stapel, Relikte und legt Grenzmarker in leere Systeme', () => {
    const { exploration } = startedGame();
    expect([...exploration.decks.industrial].sort()).toEqual([XC('ore'), XC('shard-i')]);
    expect(exploration.decks.frontier).toHaveLength(4);
    expect(exploration.relicDeck).toHaveLength(5);
    expect([...exploration.frontierTokens].sort()).toEqual([S('r1'), S('r2')]);
    expect(exploration.discards).toEqual(NO_PILES);
  });

  it('PoK Erkundung: ein freier Planet wird erkundet, eine Anlage bleibt liegen und zählt beim Bezahlen', () => {
    const { state, events } = invade('alpha-1', { industrial: ['ore', 'shard-i'] });
    expect(types(events)).toContain('PlanetExplored');
    expect(state.planets[ALPHA]?.attachments).toEqual([
      { card: XC('ore'), resources: 2, influence: 0 },
    ]);
    expect(state.exploration.decks.industrial).toEqual([XC('shard-i')]);
    expect(state.exploration.discards.industrial).toEqual([]);
    const ready = {
      ...state,
      planets: { ...state.planets, [ALPHA]: { ...state.planets[ALPHA], exhausted: false } },
    } as GameState;
    const paid = evaluatePayment(
      ready,
      content.tiles,
      RED,
      { planets: [ALPHA], tradeGoods: 0 },
      'resources',
    );
    expect(paid).toEqual({ ok: true, value: 4 });
    expect(
      ownPlanets(ready, RED, content).find((p) => p.state.id === ALPHA)?.definition.resources,
    ).toBe(4);
  });

  it('PoK Relikt: ein Fragment behält der Spieler offen, es kommt nicht auf die Ablage', () => {
    const { state, events } = invade('alpha-1', { industrial: ['shard-i'] });
    expect(events).toContainEqual({
      type: 'RelicFragmentGained',
      player: RED,
      fragment: 'industrial',
    });
    expect(playerOf(state)?.relicFragments).toEqual(['industrial']);
    expect(state.exploration.discards.industrial).toEqual([]);
  });

  it('PoK Erkundung: eine Anlage mit Spezialisierung bleibt samt Spezialisierung liegen', () => {
    const { state } = invade('beta-1', { cultural: ['archive'] });
    expect(state.planets[BETA]?.attachments).toEqual([
      { card: XC('archive'), resources: 0, influence: 2, specialty: 'biotic' },
    ]);
  });

  it('PoK Erkundung: Belohnungen wirken sofort, die Karte geht auf die Ablage', () => {
    const { state } = invade('beta-1', { cultural: ['caravan'] });
    expect(playerOf(state)?.tradeGoods).toBe(2);
    expect(state.exploration.discards.cultural).toEqual([XC('caravan')]);
  });

  it('PoK Erkundung: Einheiten aus der Verstärkung kommen auf den erkundeten Planeten', () => {
    const { state, events } = invade('delta-1', { hazardous: ['militia'] });
    const deployed = events.find((event) => event.type === 'UnitsDeployed');
    expect(deployed).toMatchObject({ ability: 'militia', planet: DELTA });
    expect(state.planets[DELTA]?.units.filter((u) => u.owner === RED)).toHaveLength(4);
  });

  it('PoK Erkundung: ein leerer Stapel wird aus der Ablage gemischt', () => {
    const { events } = invade('alpha-1', {}, { industrial: ['ore'] });
    expect(types(events)).toEqual(
      expect.arrayContaining(['ExplorationDeckReshuffled', 'AttachmentAdded']),
    );
  });

  it('PoK Erkundung: ohne Karten, ohne Eigenschaft oder bei fremdem Planeten wird nichts erkundet', () => {
    expect(types(invade('alpha-1', {}).events)).not.toContain('PlanetExplored');
    expect(types(invade('beta-2', { cultural: ['caravan'] }).events)).not.toContain(
      'PlanetExplored',
    );
    const captured = invade('alpha-1', { industrial: ['ore'] }, {}, BLUE as never);
    expect(types(captured.events)).toContain('PlanetControlGained');
    expect(types(captured.events)).not.toContain('PlanetExplored');
  });

  it('PoK Erkundung: eine unbekannte Karte wird aufgedeckt, wirkt aber nicht', () => {
    const { events } = invade('alpha-1', { industrial: ['fremd'] });
    expect(types(events)).toContain('PlanetExplored');
    expect(types(events)).not.toContain('ExplorationCardDiscarded');
  });

  it('PoK Erkundung: Einmarsch mit Erkundung lässt sich nicht zurücknehmen', () => {
    expect(isReversible(invade('alpha-1', { industrial: ['ore'] }).events)).toBe(false);
  });
});

const attached = (
  state: GameState,
  planet: typeof ALPHA,
  attachment: PlanetAttachment,
): GameState => ({
  ...state,
  planets: {
    ...state.planets,
    [planet]: {
      id: planet,
      controller: RED,
      exhausted: false,
      units: [],
      attachments: [attachment],
    },
  },
});

describe('Anlagen auf Planeten (PoK Erkundung)', () => {
  const base = startedGame();

  it('PoK Erkundung: eine Spezialisierung aus einer Anlage ersetzt eine Voraussetzung', () => {
    const state = attached(base, ALPHA, {
      card: XC('x'),
      resources: 0,
      influence: 0,
      specialty: 'propulsion',
    });
    const request = { technologies: [technologyId('drive-b')], specialties: [ALPHA] };
    expect(researchEvents(state, RED, request, content).ok).toBe(true);
    expect(currentPlanetDefinition(state, content.tiles, ALPHA)?.technologySpecialty).toBe(
      'propulsion',
    );
  });

  it('PoK Erkundung: eine eigene Spezialisierung bleibt, Einfluss zählt bei Abstimmungen', () => {
    const gamma = planetId('gamma-1');
    const definition = content.tiles.find(systemId('b3'))?.planets[0];
    if (definition === undefined) throw new Error('Planet fehlt');
    const planet = { id: gamma, controller: RED, exhausted: false, units: [] };
    const attachment = { card: XC('x'), resources: 0, influence: 2, specialty: 'biotic' } as const;
    expect(withAttachments(definition, { ...planet, attachments: [attachment] })).toMatchObject({
      technologySpecialty: 'propulsion',
      influence: 2,
    });
    const voting = votingPower(attached(base, BETA, attachment), RED, content);
    expect(voting.planets.find((p) => p.id === BETA)?.influence).toBe(4);
    expect(currentPlanetDefinition(base, content.tiles, planetId('nirgendwo'))).toBeUndefined();
  });

  it('PoK Erkundung: Ressourcen einer Anlage erhöhen den Produktionswert eines Raumdocks', () => {
    const dock = unit(T.dock);
    const spec: Spec = { id: 'b', q: 0, planet: [dock], planetId: 'alpha-1' };
    const plain = board(spec);
    const boosted = {
      ...plain,
      planets: {
        ...plain.planets,
        [ALPHA]: {
          ...plain.planets[ALPHA],
          attachments: [{ card: XC('ore'), resources: 2, influence: 0 }],
        },
      },
    } as GameState;
    const value = (state: GameState) => productionSites(state, S('b'), RED, content)[0]?.value;
    expect((value(boosted) ?? 0) - (value(plain) ?? 0)).toBe(2);
  });
});

/** Rot fliegt einen Kreuzer nach `b`, wo ein Grenzmarker liegt; Taktikaktion bis `done`. */
function frontier(
  options: { tech?: boolean; decks?: Piles; ships?: readonly Unit[]; token?: boolean } = {},
) {
  const cruiser = unit(T.cruiser);
  const ships = options.ships ?? [cruiser];
  const base = withDecks(
    board({ id: 'a', q: 0, units: ships }, { id: 'b', q: 1 }),
    options.decks ?? { frontier: ['depot'] },
  );
  const owning = updatePlayer(base, RED, (p) => ({
    ...p,
    technologies: options.tech === false ? [] : [technologyId('scanner')],
  }));
  const state = {
    ...owning,
    exploration: { ...owning.exploration, frontierTokens: options.token === false ? [] : [S('b')] },
  };
  const orders = ships.map((ship) => order(ship, ['b']));
  return run(state, [activate('b'), moves(...orders)], contextWith(MISS));
}

const EXPLORE = { type: 'ExploreFrontier', issuedBy: RED } as const;

describe('Grenzmarker (PoK Grenzmarker)', () => {
  it('PoK Grenzmarker: am Ende der Taktikaktion erkundet, der Marker verschwindet, ein Depot bleibt im System', () => {
    const state = frontier();
    expect(state.actionPhase?.tactical?.step).toBe('done');
    expect(canExploreFrontier(state, RED, content)).toBe(true);
    const after = step(state, EXPLORE);
    expect(types(after.events)).toEqual([
      'FrontierExplored',
      'TradeGoodsCachePlaced',
      'ExplorationCardDiscarded',
    ]);
    expect(after.state.exploration.frontierTokens).toEqual([]);
    expect(after.state.exploration.caches).toEqual({ b: 3 });
    expect(canExploreFrontier(after.state, RED, content)).toBe(false);
  });

  it('PoK Grenzmarker: ein Depot nimmt mit, wer nach der Bewegung Schiffe im System hat', () => {
    const cruiser = unit(T.cruiser);
    const base = board({ id: 'a', q: 0, units: [cruiser] }, { id: 'b', q: 1 });
    const state = { ...base, exploration: { ...base.exploration, caches: { b: 3 } } };
    const activated = run(state, [activate('b')]);
    const { state: after, events } = step(
      activated,
      moves(order(cruiser, ['b'])),
      contextWith(MISS),
    );
    expect(events).toContainEqual({
      type: 'TradeGoodsCacheCollected',
      player: RED,
      system: S('b'),
      amount: 3,
    });
    expect(after.exploration.caches).toEqual({});
    expect(playerOf(after)?.tradeGoods).toBe(3);
    expect(isReversible(events)).toBe(true);
    const empty = step(run(base, [activate('b')]), moves(), contextWith(MISS)).events;
    expect(types(empty)).not.toContain('TradeGoodsCacheCollected');
  });

  it('PoK Grenzmarker: eine Anlage ohne Planet verfällt, Rohstoffe nur bis zum Limit', () => {
    expect(types(step(frontier({ decks: { frontier: ['drift'] } }), EXPLORE).events)).toEqual([
      'FrontierExplored',
      'ExplorationCardDiscarded',
    ]);
    const state = updatePlayer(frontier({ decks: { frontier: ['envoys'] } }), RED, (p) => ({
      ...p,
      commodities: 2,
    }));
    expect(step(state, EXPLORE).events).toContainEqual({
      type: 'CommoditiesGained',
      player: RED,
      amount: 1,
    });
    const fragment = step(frontier({ decks: { frontier: ['shard-f'] } }), EXPLORE).state;
    expect(playerOf(fragment)?.relicFragments).toEqual(['frontier']);
  });

  it('PoK Grenzmarker: nur mit Marker, eigenem Schiff, Technologie und Karten im aktivierten System', () => {
    expect(codeOf(frontier({ token: false }), EXPLORE)).toBe('exploration.noFrontierToken');
    expect(codeOf(frontier({ tech: false }), EXPLORE)).toBe('exploration.noTechnology');
    expect(codeOf(frontier({ decks: {} }), EXPLORE)).toBe('exploration.deckEmpty');
    expect(codeOf(frontier({ ships: [] }), EXPLORE)).toBe('exploration.noShips');
    expect(codeOf(board({ id: 'a', q: 0 }), EXPLORE)).toBe('tactical.notActive');
    const moving = run(board({ id: 'a', q: 0 }, { id: 'b', q: 1 }), [activate('b')]);
    expect(codeOf(moving, EXPLORE)).toBe('tactical.wrongStep');
    expect(canExploreFrontier(moving, RED, content)).toBe(false);
    expect(canExploreFrontier(frontier(), BLUE, content)).toBe(false);
    expect(codeOf(startedGame(), EXPLORE)).toBe('phase.commandNotAllowed');
  });

  it('PoK Grenzmarker: Grenzkarten werden aus der Ablage nachgemischt', () => {
    const state = withDecks(frontier(), {}, { frontier: ['depot'] });
    expect(types(step(state, EXPLORE).events)[0]).toBe('ExplorationDeckReshuffled');
  });
});
