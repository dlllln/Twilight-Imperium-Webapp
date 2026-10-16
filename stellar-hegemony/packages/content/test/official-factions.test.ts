import { describe, expect, it } from 'vitest';
import {
  createGameHandler,
  decideGameCommand,
  evolveGame,
  formatMapString,
  gameId,
  generateGalaxyLayout,
  replayGame,
  playerId,
  factionId,
  type GameCommand,
  type GameState,
} from '@stellar/domain';
import {
  ALL_FACTIONS,
  BASE_RULE_NUMBERS,
  createBaseContent,
  FACTIONS,
  factionAbilityText,
  galaxyTemplate,
  leaderText,
  LEADERS,
  TI4_FACTIONS,
  TI4_FACTION_METADATA,
  UNIT_TYPES,
} from '../src/index.ts';

const content = createBaseContent();
const random = { nextInt: (min: number) => min };

function startWith(id: string): GameState {
  const template = galaxyTemplate(3);
  if (template === undefined) throw new Error('Missing template');
  const layout = generateGalaxyLayout(template, content.tiles, random);
  if (!layout.ok) throw new Error(layout.error.code);
  const others = TI4_FACTIONS.filter((entry) => entry.id !== id)
    .slice(0, 2)
    .map((entry) => entry.id);
  const table = {
    gameId: gameId(`test-${id}`),
    config: { playerCount: 3, victoryPointsToWin: 10, rules: BASE_RULE_NUMBERS },
    names: ['A', 'B', 'C'],
    picks: [id, ...others],
    mapString: formatMapString(layout.value),
  };
  const host = playerId('p1');
  const created = createGameHandler.decide(null, {
    type: 'CreateGame',
    issuedBy: host,
    gameId: table.gameId,
    config: table.config,
  });
  if (!created.ok) throw new Error(created.error.code);
  const initial = replayGame(created.value);
  if (!initial.ok) throw new Error(initial.error.code);
  const colors = ['orange', 'blue', 'green'] as const;
  const setup: readonly GameCommand[] = [
    ...table.picks.map((pick, index): GameCommand => ({
      type: 'SeatPlayer',
      issuedBy: playerId(`p${index + 1}`),
      name: `P${index + 1}`,
      color: colors[index] ?? 'red',
      faction: factionId(pick),
      commodityLimit: TI4_FACTIONS.find((entry) => entry.id === pick)?.commodityLimit ?? 0,
    })),
    { type: 'ImportMap', issuedBy: host, mapString: table.mapString },
    { type: 'StartGame', issuedBy: host },
  ];
  return setup.reduce((state, command) => {
    const result = decideGameCommand(state, command, { now: 0, content, random });
    if (!result.ok) throw new Error(`${id}: ${command.type}: ${result.error.code}`);
    return result.value.reduce(evolveGame, state);
  }, initial.value);
}

describe('Complete official TI4 faction selection', () => {
  it('contains 17 base, 7 PoK, Keleres and 5 Thunder’s Edge factions, without transform duplicates', () => {
    expect(TI4_FACTIONS).toHaveLength(30);
    expect(new Set(TI4_FACTIONS.map((entry) => entry.id)).size).toBe(30);
    for (const [edition, count] of Object.entries({ base: 17, pok: 7, codex: 1, te: 5 })) {
      expect(
        Object.values(TI4_FACTION_METADATA).filter((entry) => entry.edition === edition),
      ).toHaveLength(count);
    }
    expect(TI4_FACTION_METADATA['obsidian']).toBeUndefined();
  });

  it.each(TI4_FACTIONS.map((entry) => [entry.id, entry] as const))(
    '%s starts with a valid home, fleet, abilities, leaders and technologies',
    (id, faction) => {
      const game = startWith(id);
      expect(game.phase).toBe('strategy');
      expect(game.players[0]?.faction).toBe(id);
      expect(game.players[0]?.leaders).toHaveLength(id === 'nomad' ? 5 : 3);
      expect(game.systems[faction.homeSystem.id]?.spaceUnits).toHaveLength(
        faction.startingForces.space.reduce((sum, stack) => sum + stack.count, 0),
      );
      expect(
        faction.startingTechnologies.every((tech) =>
          content.technologies.some((entry) => entry.id === tech),
        ),
      ).toBe(true);
      expect(faction.abilities.every((ability) => factionAbilityText(ability.id)?.effect.de)).toBe(
        true,
      );
      expect(
        LEADERS.filter((leader) => leader.faction === id).every(
          (leader) => leaderText(leader.id)?.name.en,
        ),
      ).toBe(true);
    },
  );

  it('keeps real distinctive setups, including Hacan’s three planets and Nomad’s flagship', () => {
    const find = (id: string) => TI4_FACTIONS.find((entry) => entry.id === id);
    expect(find('hacan')?.homeSystem.planets).toHaveLength(3);
    expect(find('sol')?.homeSystem.planets[0]).toMatchObject({ resources: 4, influence: 2 });
    expect(find('nomad')?.startingForces.space).toContainEqual({
      type: UNIT_TYPES.flagship,
      count: 1,
    });
    expect(find('muaat')?.startingForces.space).toContainEqual({
      type: UNIT_TYPES.sunbreaker,
      count: 1,
    });
    expect(find('sardakk')?.startingTechnologies).toEqual([]);
  });

  it('retains legacy save identities while new automatic seats use official factions', () => {
    for (const legacy of FACTIONS) expect(ALL_FACTIONS).toContain(legacy);
    expect(ALL_FACTIONS.slice(0, 30)).toEqual(TI4_FACTIONS);
  });
});
