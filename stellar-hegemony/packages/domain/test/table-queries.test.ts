import { describe, expect, it } from 'vitest';
import {
  type GameState,
  planetId,
  type PlayerId,
  type ProductionOrder,
  productionChoices,
  researchOptions,
  specialtyPlanets,
  type SystemId,
  technologyId,
  tradePartners,
  updatePlayer,
} from '../src/index.ts';
import { activate, board, moves, S, type Spec } from './board.ts';
import { BLUE, content, RED, T, unit, units } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, step } from './game-flow.ts';

/*
 * Reine Abfragen für die Entscheidungen am Tisch: Werft (Produktion), Forschungsauslage und
 * Handelsmatte. Sie beantworten, was die Befehle beim Ausführen auch prüfen.
 */

const GAMMA = planetId('gamma-1');

/** Rot aktiviert `b` mit eigenem Dock auf Gamma-1 (Produktionswert 5) und bewegt nichts. */
function atDock(extra: Partial<Spec> = {}): GameState {
  const home: Spec = { id: 'b', q: 1, planet: [unit(T.dock)], planetId: 'gamma-1', ...extra };
  return step(run(board({ id: 'a', q: 0 }, home), [activate('b')]), moves()).state;
}

const choicesAt = (state: GameState, orders: readonly ProductionOrder[] = []) =>
  productionChoices(state, S('b'), RED, orders, content);

const choiceOf = (state: GameState, type: string, orders: readonly ProductionOrder[] = []) =>
  choicesAt(state, orders).find((choice) => choice.unit.id === type);

/** Rot kontrolliert Gamma-1 (Antriebs-Spezialisierung). */
function controlGamma(state: GameState, exhausted = false): GameState {
  const planet = state.planets[GAMMA];
  if (planet === undefined) throw new Error('Planet fehlt');
  const held = { ...planet, controller: RED, exhausted };
  return { ...state, planets: { ...state.planets, [GAMMA]: held } };
}

const request = (technologies: readonly string[], specialties: readonly string[] = []) => ({
  technologies: technologies.map(technologyId),
  specialties: specialties.map(planetId),
});

const missingOf = (state: GameState, tech: string, chosen: string[], specialties: string[] = []) =>
  researchOptions(state, RED, content, request(chosen, specialties)).find(
    (option) => option.technology.id === technologyId(tech),
  )?.missing;

const homeOf = (state: GameState, player: PlayerId): SystemId => {
  const home = Object.values(state.systems).find((system) =>
    system.spaceUnits.some((u) => u.owner === player),
  );
  if (home === undefined) throw new Error('keine Heimat');
  return home.id;
};

/** Rot und Blau sind Nachbarn (blauer Kreuzer in Rots Heimat), beide mit Waren. */
function neighbours(): GameState {
  const state = actionPhaseGame();
  const id = homeOf(state, RED);
  const system = state.systems[id] as GameState['systems'][string];
  const spaceUnits = [...system.spaceUnits, unit(T.cruiser, BLUE)];
  const shared = { ...state, systems: { ...state.systems, [id]: { ...system, spaceUnits } } };
  const stocked = (s: GameState, p: PlayerId) =>
    updatePlayer(s, p, (player) => ({ ...player, tradeGoods: 3, commodities: 2 }));
  return stocked(stocked(shared, RED), BLUE);
}

describe('Werft: baubare Einheiten mit Bestellung, Platz und Vorrat', () => {
  it('Werft: jede baubare Einheit mit Bestellmenge und Vorrat nach der Bestellung', () => {
    const state = atDock();
    const cruiser = choiceOf(state, 'cruiser', [{ type: T.cruiser, count: 2 }]);
    expect(cruiser).toMatchObject({ ordered: 2, canAdd: true, supply: 6 });
    expect(choiceOf(state, 'infantry')).toMatchObject({ ordered: 0, supply: null });
    expect(choiceOf(state, 'dock')).toBeUndefined();
    expect(choiceOf(state, 'breaker')).toBeUndefined();
  });

  it('Werft: am Produktionslimit passt keine weitere Einheit', () => {
    const state = atDock();
    const full = choicesAt(state, [{ type: T.cruiser, count: 5 }]);
    expect(full.every((choice) => !choice.canAdd)).toBe(true);
    const room = choicesAt(state, [{ type: T.cruiser, count: 4 }]);
    expect(room.some((choice) => choice.canAdd)).toBe(true);
  });

  it('Werft: ohne Vorrat lässt sich die Einheit nicht mehr bestellen', () => {
    const state = atDock({ planet: [unit(T.dock), ...units(3, T.mech)] });
    expect(choiceOf(state, 'mech')).toMatchObject({ canAdd: true, supply: 1 });
    const last = choiceOf(state, 'mech', [{ type: T.mech, count: 1 }]);
    expect(last).toMatchObject({ ordered: 1, canAdd: false, supply: 0 });
  });

  it('Werft: blockiert passen keine Schiffe, Bodentruppen schon', () => {
    const state = atDock({ units: [unit(T.cruiser, BLUE)] });
    expect(choiceOf(state, 'cruiser')?.canAdd).toBe(false);
    expect(choiceOf(state, 'fighter')?.canAdd).toBe(false);
    expect(choiceOf(state, 'infantry')?.canAdd).toBe(true);
  });
});

describe('Forschung: offene Technologien und Spezialisierungen', () => {
  it('Forschung: eine gewählte Spezialisierung ersetzt eine fehlende Farbe', () => {
    const state = controlGamma(actionPhaseGame());
    expect(missingOf(state, 'drive-b', [])).toEqual(['propulsion']);
    expect(missingOf(state, 'drive-b', [], ['gamma-1'])).toEqual([]);
    expect(missingOf(state, 'drive-c', [], ['gamma-1'])).toEqual(['propulsion']);
  });

  it('Forschung: gewählte Technologien zählen als Voraussetzung', () => {
    const state = actionPhaseGame();
    expect(missingOf(state, 'drive-b', ['drive-a'])).toEqual([]);
    expect(missingOf(state, 'drive-a', ['drive-a'])).toEqual([]);
    expect(missingOf(state, 'drive-c', ['drive-a'])).toEqual(['propulsion']);
  });

  it('Forschung: eine Spezialisierung, die eine andere gewählte Technologie braucht, fehlt hier', () => {
    const state = controlGamma(actionPhaseGame());
    expect(missingOf(state, 'drive-c', ['drive-b'], ['gamma-1'])).toEqual(['propulsion']);
    expect(missingOf(state, 'drive-b', ['drive-c'], ['gamma-1'])).toEqual([]);
  });

  it('Forschung: nur eigene, bereite Planeten bringen ihre Spezialisierung ein', () => {
    const state = actionPhaseGame();
    expect(specialtyPlanets(controlGamma(state), RED, content)).toEqual([
      { planet: GAMMA, color: 'propulsion' },
    ]);
    expect(specialtyPlanets(controlGamma(state, true), RED, content)).toEqual([]);
    expect(specialtyPlanets(controlGamma(state), BLUE, content)).toEqual([]);
    expect(missingOf(state, 'drive-b', [], ['gamma-1'])).toEqual(['propulsion']);
  });
});

describe('Handel: Partner für die Handelsmatte', () => {
  it('Handel: wer in diesem Zug schon gehandelt hat, ist kein Partner mehr', () => {
    const state = neighbours();
    expect(tradePartners(state, RED)).toEqual([BLUE]);
    const goods = (tradeGoods: number) => ({ tradeGoods, commodities: 0 });
    const offer = { partner: BLUE, offer: goods(1), request: goods(0) };
    const done = run(state, [
      { type: 'ProposeTransaction', issuedBy: RED, ...offer },
      { type: 'AcceptTransaction', issuedBy: BLUE },
    ]);
    expect(tradePartners(done, RED)).toEqual([]);
  });

  it('Handel: ohne Nachbarn gibt es keinen Partner', () => {
    expect(tradePartners(actionPhaseGame(), RED)).toEqual([]);
    expect(tradePartners(neighbours(), GREEN)).toEqual([]);
  });
});
