import { describe, expect, it } from 'vitest';
import {
  type DiplomacyChoice,
  type GameState,
  performStrategicActionHandler,
  planetId,
  type PlanetId,
  resolveSecondaryHandler,
  systemId,
  type SystemId,
  type SystemState,
  updatePlayer,
} from '../src/index.ts';
import { BLUE, CARD, contextWith, RED } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, step } from './game-flow.ts';

const HOME = systemId('home-green');
const PRIME = planetId('green-prime');
const RED_PRIME = planetId('red-prime');

const choice = (system: SystemId | null, planets: readonly PlanetId[] = []): DiplomacyChoice => ({
  mechanic: 'diplomacy',
  system,
  planets,
});

/** Grün (Karte 3) ist am Zug; seine Heimatwelt ist erschöpft. */
function greensTurn(): GameState {
  const base = actionPhaseGame();
  const exhausted = (id: PlanetId) => ({
    ...(base.planets[id] as GameState['planets'][string]),
    exhausted: true,
  });
  return {
    ...base,
    planets: { ...base.planets, [PRIME]: exhausted(PRIME), [RED_PRIME]: exhausted(RED_PRIME) },
    actionPhase: base.actionPhase && { ...base.actionPhase, active: GREEN },
  };
}

const embassy = (system: SystemId | null, issuedBy = GREEN) =>
  ({ type: 'PerformStrategicAction', issuedBy, card: CARD(3), choice: choice(system) }) as const;

const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? 'ok' : result.error?.code;

describe('Diplomatie (RR 21)', () => {
  it('RR 21.2: eigene Planeten im System bereit, alle anderen legen einen Marker dorthin', () => {
    const { state, events } = step(greensTurn(), embassy(HOME));
    expect(events.slice(1)).toEqual([
      { type: 'PlanetsReadied', player: GREEN, planets: [PRIME] },
      {
        type: 'CommandTokensPlaced',
        system: HOME,
        placements: [
          { player: RED, source: 'reinforcements' },
          { player: BLUE, source: 'reinforcements' },
        ],
      },
    ]);
    expect(state.planets[PRIME]?.exhausted).toBe(false);
    expect(state.systems[HOME]?.commandTokens).toEqual([RED, BLUE]);
    expect(state.players[0]?.reinforcementTokens).toBe(7);
  });

  it('RR 27.11: ohne eigenen Planeten bleibt die Primärfähigkeit ohne Wirkung', () => {
    const start = greensTurn();
    const planets = {
      ...start.planets,
      [PRIME]: { ...(start.planets[PRIME] as GameState['planets'][string]), controller: null },
    };
    const { events } = step({ ...start, planets }, embassy(null));
    expect(events.map((event) => event.type)).toEqual(['StrategicActionPerformed']);
    expect(codeOf(performStrategicActionHandler.decide(start, embassy(null), contextWith()))).toBe(
      'diplomacy.unknownSystem',
    );
  });

  it('wer schon einen Marker dort hat, legt keinen weiteren; ohne Nachschub aus dem vollsten Pool', () => {
    const start = greensTurn();
    const home = start.systems[HOME];
    const prepared = updatePlayer(
      {
        ...start,
        systems: { ...start.systems, [HOME]: { ...(home as SystemState), commandTokens: [RED] } },
      },
      BLUE,
      (p) => ({ ...p, reinforcementTokens: 0, commandPools: { tactic: 1, fleet: 4, strategy: 2 } }),
    );
    const { events, state } = step(prepared, embassy(HOME));
    expect(events.at(-1)).toMatchObject({ placements: [{ player: BLUE, source: 'fleet' }] });
    expect(state.players[1]?.commandPools.fleet).toBe(3);
    const broke = updatePlayer(prepared, BLUE, (p) => ({
      ...p,
      commandPools: { tactic: 0, fleet: 0, strategy: 0 },
    }));
    expect(
      step(broke, embassy(HOME)).events.find((e) => e.type === 'CommandTokensPlaced'),
    ).toMatchObject({ placements: [] });
  });

  it('nur ein System mit eigenem Planeten, nicht das Zentrum', () => {
    const state = greensTurn();
    const decide = (system: SystemId | null) =>
      codeOf(performStrategicActionHandler.decide(state, embassy(system), contextWith()));
    expect(decide(null)).toBe('diplomacy.unknownSystem');
    expect(decide(systemId('home-red'))).toBe('diplomacy.noPlanet');
    const center = {
      ...state,
      planets: {
        ...state.planets,
        [planetId('throne')]: {
          id: planetId('throne'),
          controller: GREEN,
          exhausted: false,
          units: [],
        },
      },
    };
    expect(
      codeOf(
        performStrategicActionHandler.decide(center, embassy(systemId('center')), contextWith()),
      ),
    ).toBe('diplomacy.center');
  });

  it('die Auswahl muss zur Karte passen', () => {
    const wrong = {
      ...embassy(HOME),
      choice: {
        mechanic: 'commandTokens',
        influence: { planets: [], tradeGoods: 0 },
        allocation: { tactic: 0, fleet: 0, strategy: 0 },
      },
    } as const;
    expect(codeOf(performStrategicActionHandler.decide(greensTurn(), wrong, contextWith()))).toBe(
      'strategy.choiceMismatch',
    );
  });

  it('RR 21.3: Sekundär bis zu zwei eigene erschöpfte Planeten, kostet einen Strategiemarker', () => {
    const opened = run(greensTurn(), [embassy(HOME)]);
    const secondary = (planets: readonly PlanetId[]) =>
      ({ type: 'ResolveSecondary', issuedBy: RED, choice: choice(null, planets) }) as const;
    const decide = (planets: readonly PlanetId[]) =>
      codeOf(resolveSecondaryHandler.decide(opened, secondary(planets), contextWith()));
    expect(decide([RED_PRIME, RED_PRIME])).toBe('payment.duplicatePlanet');
    expect(decide([RED_PRIME, PRIME, planetId('alpha-1')])).toBe('diplomacy.tooManyPlanets');
    expect(decide([PRIME])).toBe('diplomacy.notExhausted');
    const { state, events } = step(opened, secondary([RED_PRIME]));
    expect(events.slice(0, 2)).toEqual([
      { type: 'SecondaryResolved', player: RED, paidStrategyToken: true },
      { type: 'PlanetsReadied', player: RED, planets: [RED_PRIME] },
    ]);
    expect(state.planets[RED_PRIME]?.exhausted).toBe(false);
    expect(state.players[0]?.commandPools.strategy).toBe(1);
    const nothing = step(state, { ...secondary([]), issuedBy: BLUE });
    expect(nothing.events[0]).toMatchObject({ type: 'SecondaryResolved', player: BLUE });
  });
});
