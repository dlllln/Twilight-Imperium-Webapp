import { describe, expect, it } from 'vitest';
import {
  type GameState,
  fleetLimitOf,
  missingPrerequisites,
  performStrategicActionHandler,
  planetId,
  type PlayerId,
  producibleUnits,
  productionQuote,
  researchEvents,
  resolveSecondaryHandler,
  technologyCatalog,
  type TechnologyChoice,
  technologyId,
  updatePlayer,
  withTechnologies,
} from '../src/index.ts';
import { BLUE, CARD, content, contextWith, RED, T, TECHNOLOGIES } from './fixtures.ts';
import { actionPhaseGame, GREEN, startedGame, step } from './game-flow.ts';

const RED_PRIME = planetId('red-prime');
const BLUE_PRIME = planetId('blue-prime');
const GAMMA = planetId('gamma-1');
const id = technologyId;

const owning = (state: GameState, player: PlayerId, technologies: readonly string[]) =>
  updatePlayer(state, player, (p) => ({ ...p, technologies: technologies.map(id) }));

const definition = (name: string) => {
  const found = TECHNOLOGIES.find((tech) => tech.id === id(name));
  if (found === undefined) throw new Error(`Technologie ${name} fehlt`);
  return found;
};

/** Rot kontrolliert den Planeten mit Antriebs-Spezialisierung. */
const controlGamma = (state: GameState, exhausted = false): GameState => {
  const planet = state.planets[GAMMA];
  if (planet === undefined) throw new Error('Planet fehlt');
  return {
    ...state,
    planets: { ...state.planets, [GAMMA]: { ...planet, controller: RED, exhausted } },
  };
};

const request = (technologies: readonly string[], specialties: readonly string[] = []) => ({
  technologies: technologies.map(id),
  specialties: specialties.map(planetId),
});

const codeOf = (state: GameState, technologies: readonly string[], specialties: string[] = []) => {
  const result = researchEvents(state, RED, request(technologies, specialties), content);
  return result.ok ? result.value.map((event) => event.type) : result.error.code;
};

describe('Technologien verändern Einheitenwerte (RR 80.1, RR 80.6)', () => {
  it('RR 80.1: nur der Besitzer profitiert; ohne Besitzer gelten die Grundwerte', () => {
    const state = owning(actionPhaseGame(), RED, ['drive-a', 'gunnery']);
    const catalog = technologyCatalog(state, content);
    expect(catalog.find(T.cruiser, RED)).toMatchObject({ move: 3, combat: { hitOn: 6, dice: 1 } });
    expect(catalog.find(T.battleship, RED)?.combat).toEqual({ hitOn: 5, dice: 2 });
    expect(catalog.find(T.cruiser, BLUE)).toMatchObject({ move: 2, combat: { hitOn: 7 } });
    expect(catalog.find(T.cruiser)?.move).toBe(2);
    expect(catalog.find(id('unknown') as never, RED)).toBeUndefined();
    expect(catalog.all(RED).find((unit) => unit.id === T.cruiser)?.move).toBe(3);
    expect(catalog.all()).toHaveLength(content.units.all().length);
  });

  it('RR 80.6: Aufwertungen ersetzen Grundwerte, Boni kommen danach dazu', () => {
    const state = owning(actionPhaseGame(), RED, [
      'drive-a',
      'drive-b',
      'drive-c',
      'heavy-carrier',
    ]);
    const carrier = technologyCatalog(state, content).find(T.carrier, RED);
    expect(carrier).toMatchObject({ move: 3, capacity: 6 });
  });

  it('RR 80.1: Fähigkeiten werden verstärkt oder hinzugefügt, Würfelziele bleiben mindestens 1', () => {
    const state = owning(actionPhaseGame(), RED, ['targeting', 'armour']);
    const catalog = technologyCatalog(state, content);
    expect(catalog.find(T.escort, RED)?.capabilities).toEqual([
      { kind: 'antiFighterBarrage', profile: { hitOn: 8, dice: 3 } },
    ]);
    expect(catalog.find(T.battery, RED)?.capabilities[0]).toMatchObject({ range: 1 });
    expect(catalog.find(T.dock, RED)?.capabilities).toEqual([
      { kind: 'production', bonus: 3, addsPlanetResources: true },
      { kind: 'fighterHangar', fighters: 4 },
    ]);
    expect(catalog.find(T.infantry, RED)?.capabilities).toEqual([{ kind: 'sustainDamage' }]);
    const sharp = {
      ...content,
      technologies: [
        {
          ...definition('gunnery'),
          modifiers: [{ target: { types: [T.cruiser] }, change: { hitOn: -20 } }],
        },
      ],
    };
    expect(
      technologyCatalog(owning(state, RED, ['gunnery']), sharp).find(T.cruiser, RED)?.combat,
    ).toEqual({ hitOn: 1, dice: 1 });
  });

  it('eine hinzugefügte Fähigkeit, die die Einheit schon hat, wird nicht verdoppelt', () => {
    const doubled = {
      ...definition('armour'),
      modifiers: [
        {
          target: { types: [T.battleship] },
          change: { add: [{ kind: 'sustainDamage' } as const] },
        },
      ],
    };
    const state = owning(actionPhaseGame(), RED, ['armour']);
    const catalog = technologyCatalog(state, { ...content, technologies: [doubled] });
    const kinds = catalog.find(T.battleship, RED)?.capabilities.map((c) => c.kind);
    expect(kinds).toEqual(['sustainDamage', 'bombardment']);
  });

  it('RR 80.1: Befehle werden mit den verbesserten Werten entschieden', () => {
    const state = owning(actionPhaseGame(), RED, ['drive-a']);
    expect(withTechnologies(contextWith(), state).content.units.find(T.cruiser, RED)?.move).toBe(3);
  });

  it('RR 28: Technologien können das Flottenlimit erhöhen', () => {
    const state = actionPhaseGame();
    const fleet = state.players.find((p) => p.id === RED)?.commandPools.fleet ?? 0;
    expect(fleetLimitOf(state, RED, content)).toBe(fleet);
    expect(fleetLimitOf(owning(state, RED, ['drive-b']), RED, content)).toBe(fleet + 2);
    expect(fleetLimitOf(state, 'ghost' as PlayerId, content)).toBe(0);
  });

  it('RR 80.1: die Produktionsvorschau rechnet mit den Kosten nach Technologien', () => {
    const cheap = {
      ...definition('gunnery'),
      modifiers: [
        {
          target: { types: [T.cruiser] },
          change: { set: { cost: { resources: 1, unitsPerCost: 1 } } },
        },
      ],
    };
    const state = owning(actionPhaseGame(), RED, ['gunnery']);
    const home = Object.values(state.systems).find((s) => s.planetIds.includes(RED_PRIME));
    if (home === undefined) throw new Error('Heimat fehlt');
    const orders = [{ type: T.cruiser, count: 2 }];
    const quote = (technologies: typeof TECHNOLOGIES) =>
      productionQuote(state, home.id, RED, orders, { ...content, technologies }).cost;
    expect(quote(TECHNOLOGIES)).toBe(4);
    expect(quote([cheap])).toBe(2);
  });

  it('RR 80.5: Starttechnologien erhält die Fraktion ohne Voraussetzungen', () => {
    const state = startedGame();
    expect(state.players.find((p) => p.id === GREEN)?.technologies).toEqual([id('drive-a')]);
    expect(state.players.find((p) => p.id === RED)?.technologies).toEqual([]);
  });

  it('RR 80.1: nur wer die Bauplan-Technologie besitzt, kann die Einheit produzieren', () => {
    const state = actionPhaseGame();
    const types = (game: GameState) => producibleUnits(game, RED, content.units).map((u) => u.id);
    expect(types(state)).not.toContain(T.breaker);
    expect(types(owning(state, RED, ['breaker-plans']))).toContain(T.breaker);
  });
});

describe('Technologien erforschen (RR 80.12–80.15)', () => {
  it('RR 80.12: jede Voraussetzung braucht eine eigene Technologie dieser Farbe', () => {
    const owned = [definition('drive-a'), definition('heavy-carrier')];
    expect(missingPrerequisites(owned, definition('drive-c'))).toEqual(['propulsion']);
    expect(missingPrerequisites([], definition('gunnery'))).toEqual([]);
  });

  it('RR 80.7: Aufwertungen erfüllen keine Voraussetzungen', () => {
    const state = owning(actionPhaseGame(), RED, ['heavy-carrier']);
    expect(codeOf(state, ['drive-b'])).toBe('technology.prerequisites');
  });

  it('RR 80.12: die erste Technologie zählt schon als Voraussetzung der zweiten', () => {
    const state = actionPhaseGame();
    expect(codeOf(state, ['drive-a', 'drive-b'])).toEqual([
      'TechnologyResearched',
      'TechnologyResearched',
    ]);
    expect(codeOf(state, ['drive-b', 'drive-a'])).toBe('technology.prerequisites');
  });

  it('RR 80.14: ein eigener Planet mit Spezialisierung ersetzt eine Voraussetzung und wird erschöpft', () => {
    const state = controlGamma(holdingResearch());
    expect(codeOf(state, ['drive-b'], ['gamma-1'])).toEqual([
      'PlanetsExhausted',
      'TechnologyResearched',
    ]);
    const { state: after } = step(state, act(choice(['drive-b'], ['gamma-1'])));
    expect(after.planets[GAMMA]?.exhausted).toBe(true);
  });

  it('RR 80.15: erschöpfte, fremde, doppelte oder unnötige Spezialisierungen sind ungültig', () => {
    const state = actionPhaseGame();
    expect(codeOf(controlGamma(state, true), ['drive-b'], ['gamma-1'])).toBe(
      'technology.specialty',
    );
    expect(codeOf(state, ['drive-b'], ['gamma-1'])).toBe('technology.specialty');
    expect(codeOf(controlGamma(state), ['drive-b'], ['gamma-1', 'gamma-1'])).toBe(
      'technology.specialty',
    );
    expect(codeOf(state, ['drive-b'], ['red-prime'])).toBe('technology.specialty');
    expect(codeOf(controlGamma(state), ['gunnery'], ['gamma-1'])).toBe(
      'technology.unusedSpecialty',
    );
  });

  it('unbekannte oder schon erforschte Technologien sind Fehler', () => {
    const state = owning(actionPhaseGame(), RED, ['gunnery']);
    expect(codeOf(state, ['nothing'])).toBe('technology.unknown');
    expect(codeOf(state, ['gunnery'])).toBe('technology.owned');
    expect(codeOf(state, ['drive-a', 'drive-a'])).toBe('technology.owned');
  });
});

function choice(
  technologies: readonly string[],
  specialties: readonly string[] = [],
  payment: TechnologyChoice['payment'] = { planets: [], tradeGoods: 0 },
): TechnologyChoice {
  return {
    mechanic: 'technology',
    technologies: technologies.map(id),
    specialties: specialties.map(planetId),
    payment,
  };
}

/** Rot hält die Technologie-Karte (Initiative 7) und ist am Zug. */
function holdingResearch(state = actionPhaseGame()): GameState {
  const card = state.strategyCards[CARD(7)];
  if (card === undefined) throw new Error('Karte fehlt');
  return {
    ...state,
    strategyCards: { ...state.strategyCards, [card.id]: { ...card, holder: RED } },
  };
}

const act = (picked: TechnologyChoice) =>
  ({ type: 'PerformStrategicAction', issuedBy: RED, card: CARD(7), choice: picked }) as const;

const actCode = (state: GameState, picked: TechnologyChoice) => {
  const result = performStrategicActionHandler.decide(state, act(picked), contextWith());
  return result.ok ? 'ok' : result.error.code;
};

const withGoods = (state: GameState, player: PlayerId, tradeGoods: number) =>
  updatePlayer(state, player, (p) => ({ ...p, tradeGoods }));

describe('Strategiekarte Technologie (RR 81)', () => {
  it('RR 81.2: eine Technologie kostenlos', () => {
    const { state, events } = step(holdingResearch(), act(choice(['gunnery'])));
    expect(events.map((event) => event.type)).toEqual([
      'StrategicActionPerformed',
      'TechnologyResearched',
    ]);
    expect(state.players.find((p) => p.id === RED)?.technologies).toEqual([id('gunnery')]);
  });

  it('RR 81.2: eine zweite Technologie kostet 6 Ressourcen', () => {
    const state = withGoods(holdingResearch(), RED, 3);
    const paid = choice(['gunnery', 'targeting'], [], { planets: [RED_PRIME], tradeGoods: 3 });
    const { state: after } = step(state, act(paid));
    expect(after.players.find((p) => p.id === RED)).toMatchObject({
      tradeGoods: 0,
      technologies: [id('gunnery'), id('targeting')],
    });
    expect(after.planets[RED_PRIME]?.exhausted).toBe(true);
    const cheap = choice(['gunnery', 'targeting'], [], { planets: [RED_PRIME], tradeGoods: 0 });
    expect(actCode(state, cheap)).toBe('technology.cost');
  });

  it('RR 81.2: mindestens eine, höchstens zwei Technologien; Planeten zahlen nicht doppelt', () => {
    const state = controlGamma(holdingResearch());
    expect(actCode(state, choice([]))).toBe('technology.count');
    expect(actCode(state, choice(['gunnery', 'targeting', 'armour']))).toBe('technology.count');
    const twice = choice(['drive-a', 'drive-c'], ['gamma-1'], { planets: [GAMMA], tradeGoods: 6 });
    expect(actCode(withGoods(state, RED, 6), twice)).toBe('technology.specialty');
  });

  it('RR 81.3: Mitspieler erforschen für einen Strategiemarker und 4 Ressourcen eine Technologie', () => {
    const { state } = step(holdingResearch(), act(choice(['gunnery'])));
    const next = state.actionPhase?.secondary?.awaiting[0] as PlayerId;
    expect(next).toBe(BLUE);
    const funded = withGoods(state, BLUE, 1);
    const resolve = (picked: TechnologyChoice) =>
      resolveSecondaryHandler.decide(
        funded,
        { type: 'ResolveSecondary', issuedBy: BLUE, choice: picked },
        contextWith(),
      );
    const pay = { planets: [BLUE_PRIME], tradeGoods: 1 };
    const result = resolve(choice(['targeting'], [], pay));
    expect(result.ok && result.value.map((event) => event.type)).toContain('TechnologyResearched');
    expect(resolve(choice(['targeting', 'armour'], [], pay))).toMatchObject({
      error: { code: 'technology.count' },
    });
    expect(resolve(choice(['targeting'], [], { planets: [], tradeGoods: 1 }))).toMatchObject({
      error: { code: 'technology.cost' },
    });
  });
});
