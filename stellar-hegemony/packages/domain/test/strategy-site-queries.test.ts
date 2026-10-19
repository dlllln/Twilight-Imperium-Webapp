import { describe, expect, it } from 'vitest';
import {
  constructionSites,
  decideGameCommand,
  diplomacyPlacements,
  diplomacySystems,
  type GameCommand,
  type GameState,
  planetId,
  type PlanetId,
  type PlayerId,
  type StructurePlacement,
  type SystemId,
  updatePlayer,
} from '../src/index.ts';
import { BLUE, CARD, content, contextWith, RED, T } from './fixtures.ts';
import { actionPhaseGame, GREEN, run } from './game-flow.ts';

const RED_PRIME = planetId('red-prime');
const BLUE_PRIME = planetId('blue-prime');
const GREEN_PRIME = planetId('green-prime');
const ALPHA = planetId('alpha-1');
const THRONE = planetId('throne');

const systemOf = (state: GameState, planet: PlanetId): SystemId => {
  const found = Object.values(state.systems).find((system) => system.planetIds.includes(planet));
  if (found === undefined) throw new Error('Planet ohne System');
  return found.id;
};

/** Übergibt Planeten an einen Spieler (oder an niemanden). */
function controlled(state: GameState, player: PlayerId | null, ids: readonly PlanetId[]) {
  const planets = { ...state.planets };
  for (const id of ids) {
    const planet = planets[id];
    if (planet !== undefined) planets[id] = { ...planet, controller: player };
  }
  return { ...state, planets };
}

/** Grün (Diplomatie, Karte 3) ist am Zug. */
function greensTurn(): GameState {
  const base = actionPhaseGame();
  return { ...base, actionPhase: base.actionPhase && { ...base.actionPhase, active: GREEN } };
}

const embassy = (system: SystemId | null): GameCommand => ({
  type: 'PerformStrategicAction',
  issuedBy: GREEN,
  card: CARD(3),
  choice: { mechanic: 'diplomacy', system, planets: [] },
});

const construction = (placements: readonly StructurePlacement[], system: SystemId | null) =>
  ({ mechanic: 'construction', placements, system }) as const;

const accepted = (state: GameState, command: GameCommand): boolean =>
  decideGameCommand(state, command, contextWith()).ok;

const sitesOf = (state: GameState, player: PlayerId, ability: 'primary' | 'secondary') =>
  constructionSites(state, player, content.units, ability).map((site) => [
    site.planet,
    [...site.types].sort(),
  ]);

/** Rot hat Infrastruktur primär gespielt; Blau entscheidet über die Sekundärfähigkeit. */
const bluesSecondary = (): GameState =>
  run(actionPhaseGame(), [
    {
      type: 'PerformStrategicAction',
      issuedBy: RED,
      card: CARD(4),
      choice: construction([{ type: T.battery, planet: RED_PRIME }], null),
    },
  ]);

describe('Abfragen für Diplomatie und Infrastruktur', () => {
  it('Diplomatie: wählbar sind Systeme mit eigenem Planeten außerhalb des Zentrums', () => {
    const state = controlled(greensTurn(), GREEN, [ALPHA, THRONE]);
    const systems = diplomacySystems(state, GREEN, content.tiles);
    const expected = [systemOf(state, GREEN_PRIME), systemOf(state, ALPHA)];
    expect([...systems].sort()).toEqual([...expected].sort());
    expect(systems).not.toContain(systemOf(state, THRONE));
    for (const system of systems) expect(accepted(state, embassy(system))).toBe(true);
    expect(accepted(state, embassy(systemOf(state, THRONE)))).toBe(false);
  });

  it('Diplomatie: ohne eigenen Planeten ist die Liste leer und system null wird angenommen', () => {
    const state = controlled(greensTurn(), null, [GREEN_PRIME]);
    expect(diplomacySystems(state, GREEN, content.tiles)).toEqual([]);
    expect(accepted(state, embassy(null))).toBe(true);
  });

  it('Diplomatie: Marker legt nur, wer noch keinen im System hat und einen aufbringen kann', () => {
    const state = greensTurn();
    const home = systemOf(state, GREEN_PRIME);
    const players = (s: GameState) =>
      diplomacyPlacements(s, home, GREEN).map((placement) => placement.player);
    expect([...players(state)].sort()).toEqual([BLUE, RED].sort());
    const broke = updatePlayer(state, BLUE, (p) => ({
      ...p,
      reinforcementTokens: 0,
      commandPools: { tactic: 0, fleet: 0, strategy: 0 },
    }));
    expect(players(broke)).toEqual([RED]);
    const result = decideGameCommand(broke, embassy(home), contextWith());
    const placed = result.ok
      ? result.value.flatMap((event) =>
          event.type === 'CommandTokensPlaced' ? event.placements : [],
        )
      : [];
    expect(placed.map((placement) => placement.player)).toEqual([RED]);
  });

  it('Infrastruktur: jeder eigene Planet mit Platz bietet seine Gebäude an', () => {
    const state = controlled(actionPhaseGame(), RED, [ALPHA]);
    const sites = sitesOf(state, RED, 'primary');
    expect(sites).toContainEqual([RED_PRIME, [T.battery, T.longBattery].sort()]);
    expect(sites).toContainEqual([ALPHA, [T.battery, T.dock, T.longBattery].sort()]);
    expect(sites).toHaveLength(2);
    const [site] = constructionSites(state, RED, content.units, 'primary');
    expect(site?.system).toBe(systemOf(state, site?.planet ?? RED_PRIME));
  });

  it('Infrastruktur: ein vorgemerktes Raumdock belegt den Platz für ein zweites', () => {
    const state = controlled(actionPhaseGame(), RED, [ALPHA]);
    const planned = [{ type: T.dock, planet: ALPHA }];
    const alpha = constructionSites(state, RED, content.units, 'primary', planned).find(
      (site) => site.planet === ALPHA,
    );
    expect([...(alpha?.types ?? [])].sort()).toEqual([T.battery, T.longBattery].sort());
    const batteries = [
      { type: T.battery, planet: RED_PRIME },
      { type: T.battery, planet: RED_PRIME },
    ];
    const full = constructionSites(state, RED, content.units, 'primary', batteries);
    expect(full.map((site) => site.planet)).toEqual([ALPHA]);
  });

  it('Infrastruktur sekundär: Systeme mit eigenem Marker fallen weg, ohne Nachschub gibt es keine Stelle', () => {
    const state = bluesSecondary();
    expect(sitesOf(state, BLUE, 'secondary').map(([planet]) => planet)).toEqual([BLUE_PRIME]);
    const home = systemOf(state, BLUE_PRIME);
    const system = state.systems[home] as GameState['systems'][string];
    const marked = {
      ...state,
      systems: { ...state.systems, [home]: { ...system, commandTokens: [BLUE] } },
    };
    expect(constructionSites(marked, BLUE, content.units, 'secondary')).toEqual([]);
    expect(sitesOf(marked, BLUE, 'primary').map(([planet]) => planet)).toEqual([BLUE_PRIME]);
    const empty = updatePlayer(state, BLUE, (p) => ({ ...p, reinforcementTokens: 0 }));
    expect(constructionSites(empty, BLUE, content.units, 'secondary')).toEqual([]);
  });

  it('jede angebotene Stelle besteht die Probe der Domain', () => {
    const primary = controlled(actionPhaseGame(), RED, [ALPHA]);
    for (const site of constructionSites(primary, RED, content.units, 'primary'))
      for (const type of site.types) {
        const choice = construction([{ type, planet: site.planet }], null);
        const command = { type: 'PerformStrategicAction', issuedBy: RED, card: CARD(4), choice };
        expect(accepted(primary, command as GameCommand)).toBe(true);
      }
    const secondary = bluesSecondary();
    for (const site of constructionSites(secondary, BLUE, content.units, 'secondary'))
      for (const type of site.types) {
        const choice = construction([{ type, planet: site.planet }], site.system);
        expect(accepted(secondary, { type: 'ResolveSecondary', issuedBy: BLUE, choice })).toBe(
          true,
        );
      }
  });
});
