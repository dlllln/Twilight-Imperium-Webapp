import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  adjacentSystemIds,
  areAdjacentHexes,
  areSystemsAdjacent,
  assembleGalaxy,
  decideGameCommand,
  formatMapString,
  type GameState,
  generateGalaxyLayout,
  hex,
  type MapLayout,
  parseMapString,
  playerId,
  replayGame,
  systemId,
  type SystemState,
  violatesPlacement,
} from '../src/index.ts';
import { config, content, contextWith, RED, ScriptedRandom, TEMPLATE } from './fixtures.ts';

const SMALL_MAP = 'center b1 b2 r1 b3 r2 b4 H . . . H . . . H';

function layoutOf(mapString: string): MapLayout {
  const parsed = parseMapString(mapString);
  if (!parsed.ok) throw new Error(parsed.error.code);
  return parsed.value;
}

function setupState(): GameState {
  const state = replayGame([
    { type: 'GameCreated', gameId: 'g' as never, host: RED, config: config(3) },
  ]);
  if (!state.ok) throw new Error('setup');
  return state.value;
}

const system = (
  id: string,
  q: number,
  r: number,
  wormholes: SystemState['wormholes'] = [],
): SystemState => ({
  id: systemId(id),
  position: hex(q, r),
  planetIds: [],
  wormholes,
  spaceUnits: [],
  commandTokens: [],
});

describe('Map-String (Import vordefinierter Karten)', () => {
  it('liest Tafeln in Spiral-Reihenfolge ab dem Zentrum', () => {
    const layout = layoutOf(SMALL_MAP);
    expect(layout[0]).toEqual({ position: hex(0, 0), content: { kind: 'tile', tileId: 'center' } });
    expect(layout[1]).toEqual({ position: hex(0, -1), content: { kind: 'tile', tileId: 'b1' } });
    expect(layout.filter((slot) => slot.content.kind === 'home')).toHaveLength(3);
  });

  it('leere Felder (.) werden ausgelassen', () => {
    expect(layoutOf(SMALL_MAP)).toHaveLength(10);
  });

  it('Formatieren und erneutes Einlesen ergibt dasselbe Layout', () => {
    expect(formatMapString(layoutOf(SMALL_MAP))).toBe(SMALL_MAP);
    expect(layoutOf(formatMapString(layoutOf(SMALL_MAP)))).toEqual(layoutOf(SMALL_MAP));
  });

  it('lehnt leere Strings und ungültige Zeichen ab', () => {
    expect(parseMapString('   ')).toMatchObject({ ok: false, error: { code: 'map.empty' } });
    expect(parseMapString('center b1 <script>')).toMatchObject({
      ok: false,
      error: { code: 'map.invalidToken' },
    });
  });
});

describe('Galaxie-Aufbau (RR Aufbau Schritt 6)', () => {
  it('erzeugt Systeme und Heimat-Plätze aus einem gültigen Layout', () => {
    const assembled = assembleGalaxy(layoutOf(SMALL_MAP), content.tiles, 3);
    expect(assembled.ok && assembled.value.systems).toHaveLength(7);
    expect(assembled.ok && assembled.value.homeSlots).toHaveLength(3);
    const nebula = assembled.ok ? assembled.value.systems.find((s) => s.id === 'r1') : undefined;
    expect(nebula?.anomaly).toBe('nebula');
  });

  it.each([
    ['center b1 b1 H . . H . . H', 'galaxy.duplicateTile'],
    ['center b1 nope H . . H . . H', 'galaxy.unknownTile'],
    ['b1 center b2 H . . H . . H', 'galaxy.center'],
    ['center home-x b2 H . . H . . H', 'galaxy.homeTile'],
    ['center b1 b2 H . . H', 'galaxy.homeSlots'],
  ])('lehnt %s ab (%s)', (mapString, code) => {
    expect(assembleGalaxy(layoutOf(mapString), content.tiles, 3)).toMatchObject({
      ok: false,
      error: { code },
    });
  });

  it('lehnt doppelt belegte Felder ab', () => {
    const layout = layoutOf(SMALL_MAP);
    const duplicate = [...layout, { position: hex(0, -1), content: { kind: 'home' } } as const];
    expect(assembleGalaxy(duplicate, content.tiles, 4)).toMatchObject({
      ok: false,
      error: { code: 'galaxy.duplicatePosition' },
    });
  });
});

describe('Galaxie-Generator (Factory)', () => {
  it('verteilt alle Felder der Vorlage und bleibt deterministisch', () => {
    const first = generateGalaxyLayout(
      TEMPLATE,
      content.tiles,
      new ScriptedRandom([3, 1, 4, 1, 5]),
    );
    const second = generateGalaxyLayout(
      TEMPLATE,
      content.tiles,
      new ScriptedRandom([3, 1, 4, 1, 5]),
    );
    expect(first).toEqual(second);
    expect(first.ok && first.value).toHaveLength(1 + 3 + 6);
  });

  it('Aufbauregel: keine Anomalien oder gleichen Wurmlöcher nebeneinander, wenn vermeidbar', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(30), { minLength: 1, maxLength: 20 }), (script) => {
        const layout = generateGalaxyLayout(TEMPLATE, content.tiles, new ScriptedRandom(script));
        if (!layout.ok) return false;
        const placed = layout.value.flatMap((slot) =>
          slot.content.kind === 'tile' && slot.content.tileId !== 'center'
            ? [{ position: slot.position, tile: content.tiles.find(slot.content.tileId) }]
            : [],
        );
        return placed.every((a) =>
          placed.every(
            (b) =>
              a === b ||
              !areAdjacentHexes(a.position, b.position) ||
              !a.tile ||
              !b.tile ||
              !violatesPlacement(a.tile, b.tile),
          ),
        );
      }),
    );
  });

  it('meldet fehlende Zentrumstafel und zu wenige Tafeln', () => {
    const noCenter = {
      find: () => undefined,
      all: () => content.tiles.all().filter((t) => t.back !== 'center'),
    };
    expect(generateGalaxyLayout(TEMPLATE, noCenter, new ScriptedRandom([0])).ok).toBe(false);
    const greedy = { ...TEMPLATE, blueTiles: 40 };
    expect(generateGalaxyLayout(greedy, content.tiles, new ScriptedRandom([0]))).toMatchObject({
      ok: false,
      error: { code: 'galaxy.notEnoughTiles' },
    });
  });
});

describe('Nachbarschaft (RR 7, RR 88 Wurmlöcher)', () => {
  it('Systeme mit gemeinsamer Kante sind benachbart, ein System nicht zu sich selbst', () => {
    expect(areSystemsAdjacent(system('a', 0, 0), system('b', 0, 1))).toBe(true);
    expect(areSystemsAdjacent(system('a', 0, 0), system('a', 0, 0))).toBe(false);
    expect(areSystemsAdjacent(system('a', 0, 0), system('b', 0, 2))).toBe(false);
  });

  it('RR 88: gleiche Wurmlöcher verbinden entfernte Systeme', () => {
    expect(areSystemsAdjacent(system('a', 0, 0, ['alpha']), system('b', 3, 0, ['alpha']))).toBe(
      true,
    );
    expect(areSystemsAdjacent(system('a', 0, 0, ['alpha']), system('b', 3, 0, ['beta']))).toBe(
      false,
    );
  });

  it('listet alle Nachbarn eines Systems', () => {
    const origin = system('a', 0, 0, ['beta']);
    const systems = {
      a: origin,
      b: system('b', 1, 0),
      c: system('c', 4, 0, ['beta']),
      d: system('d', 2, 0),
    };
    expect(adjacentSystemIds(systems, origin)).toEqual(['b', 'c']);
  });
});

describe('Commands ImportMap und GenerateGalaxy', () => {
  it('der Gastgeber importiert eine Karte; Systeme und Planeten entstehen', () => {
    const state = setupState();
    const decided = decideGameCommand(
      state,
      { type: 'ImportMap', issuedBy: RED, mapString: SMALL_MAP },
      contextWith(),
    );
    const next = decided.ok
      ? replayGame([
          { type: 'GameCreated', gameId: state.id, host: RED, config: state.config },
          ...decided.value,
        ])
      : null;
    expect(next?.ok && Object.keys(next.value.systems)).toHaveLength(7);
    expect(next?.ok && next.value.planets['beta-2']).toEqual({
      id: 'beta-2',
      controller: null,
      exhausted: false,
      units: [],
    });
    expect(next?.ok && next.value.homeSlots).toHaveLength(3);
  });

  it('nur der Gastgeber und nur im Aufbau', () => {
    const state = setupState();
    const command = {
      type: 'ImportMap',
      issuedBy: playerId('gast'),
      mapString: SMALL_MAP,
    } as const;
    expect(decideGameCommand(state, command, contextWith())).toMatchObject({
      ok: false,
      error: { code: 'setup.hostOnly' },
    });
    const started = { ...state, phase: 'strategy' } as const;
    expect(
      decideGameCommand(started, { type: 'GenerateGalaxy', issuedBy: RED }, contextWith()),
    ).toMatchObject({ ok: false, error: { code: 'phase.commandNotAllowed' } });
  });

  it('GenerateGalaxy nutzt die Vorlage für die Spielerzahl', () => {
    const decided = decideGameCommand(
      setupState(),
      { type: 'GenerateGalaxy', issuedBy: RED },
      contextWith(new ScriptedRandom([2, 7])),
    );
    const event = decided.ok ? decided.value[0] : undefined;
    expect(event?.type === 'GalaxyAssembled' && event.systems).toHaveLength(7);
  });

  it('ohne Vorlage für die Spielerzahl gibt es keine Zufallsgalaxie', () => {
    const state = { ...setupState(), config: config(4) };
    expect(
      decideGameCommand(state, { type: 'GenerateGalaxy', issuedBy: RED }, contextWith()),
    ).toMatchObject({ ok: false, error: { code: 'galaxy.noTemplate' } });
  });
});
