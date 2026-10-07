import { heuristicBot } from '@stellar/bots';
import { BASE_RULE_NUMBERS, createBaseContent } from '@stellar/content';
import { formatMapString, generateGalaxyLayout, type GameEvent } from '@stellar/domain';
import {
  InMemoryEventStore,
  InMemoryLobbyStore,
  InProcessEventPublisher,
  SeededRandom,
  SystemClock,
} from '@stellar/infrastructure';
import { type BotPort, GameController, type IdGeneratorPort, OnlineGames } from '../src/index.ts';

export const content = createBaseContent();

/** Vorhersehbare Codes und Schlüssel: ABC001, ABC002 … und t1, t2 … */
export class CountingIds implements IdGeneratorPort {
  private codes = 0;
  private tokens = 0;

  constructor(private readonly repeatFirstCode = 0) {}

  lobbyCode(): string {
    if (this.repeatFirstCode > 0) return 'ABC000';
    this.codes += 1;
    return `ABC${String(this.codes).padStart(3, '0')}`;
  }

  seatToken(): string {
    this.tokens += 1;
    return `t${String(this.tokens)}`;
  }
}

export function mapFor(playerCount: number, seed = 5): string {
  const template = content.galaxyTemplate(playerCount);
  if (template === undefined) throw new Error('Keine Vorlage');
  const layout = generateGalaxyLayout(template, content.tiles, new SeededRandom(seed));
  if (!layout.ok) throw new Error(layout.error.code);
  return formatMapString(layout.value);
}

export function onlineGames(options: { bot?: BotPort; ids?: IdGeneratorPort } = {}) {
  const publisher = new InProcessEventPublisher();
  const published: GameEvent[][] = [];
  publisher.subscribe((_, events) => published.push([...events]));
  const games = new GameController({
    store: new InMemoryEventStore(),
    publisher,
    random: new SeededRandom(9),
    clock: new SystemClock(),
    content,
  });
  const lobbies = new InMemoryLobbyStore();
  const online = new OnlineGames({
    lobbies,
    ids: options.ids ?? new CountingIds(),
    games,
    bot: options.bot ?? heuristicBot,
    table: { rules: BASE_RULE_NUMBERS, victoryPointsToWin: 10 },
  });
  return { online, games, lobbies, published };
}
