import { BASE_RULE_NUMBERS, createBaseContent } from '@stellar/content';
import {
  andThen,
  createGameHandler,
  currentActor,
  decideGameCommand,
  type DecisionContext,
  evolveGame,
  gameId,
  type GameCommand,
  type GameState,
  type PlayerColor,
  playerId,
  replayGame,
} from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { heuristicBot } from '../src/index.ts';

export const content = createBaseContent();
const COLORS: readonly PlayerColor[] = [
  'orange',
  'blue',
  'green',
  'yellow',
  'purple',
  'red',
  'pink',
  'black',
];

export const contextFor = (state: GameState, seed: number): DecisionContext => ({
  random: new SeededRandom(seed + state.version),
  now: 0,
  content,
});

/** Führt einen Command aus; Fehler brechen den Testaufbau ab. */
export function apply(state: GameState, command: GameCommand, seed: number): GameState {
  const decided = decideGameCommand(state, command, contextFor(state, seed));
  if (!decided.ok) throw new Error(`${command.type}: ${decided.error.code}`);
  return decided.value.reduce(evolveGame, state);
}

const seat = (index: number): GameCommand => {
  const faction = content.factions[index] ?? content.factions[0];
  if (faction === undefined) throw new Error('Keine Fraktion');
  return {
    type: 'SeatPlayer',
    issuedBy: playerId(`p${String(index + 1)}`),
    name: `Bot ${String(index + 1)}`,
    color: COLORS[index] ?? 'black',
    faction: faction.id,
    commodityLimit: faction.commodityLimit,
  };
};

/** Partie mit echter Galaxie und echten Fraktionen, gestartet. */
export function botGame(playerCount: number, seed: number): GameState {
  const host = playerId('p1');
  const config = { playerCount, victoryPointsToWin: 10, rules: BASE_RULE_NUMBERS };
  const command = { type: 'CreateGame', issuedBy: host, gameId: gameId('bots'), config } as const;
  const created = andThen(createGameHandler.decide(null, command), replayGame);
  if (!created.ok) throw new Error(created.error.code);
  const commands: readonly GameCommand[] = [
    ...Array.from({ length: playerCount }, (_, index) => seat(index)),
    { type: 'GenerateGalaxy', issuedBy: host },
    { type: 'StartGame', issuedBy: host },
  ];
  return commands.reduce((state, next) => apply(state, next, seed), created.value);
}

export interface BotRun {
  readonly state: GameState;
  readonly commands: readonly GameCommand[];
  readonly stuck: boolean;
}

const finished = (state: GameState) => state.phase === 'gameOver';

/** Lässt Bots ziehen, bis die Partie endet, das Limit erreicht ist oder kein Bot weiterkommt. */
export function playBots(
  start: GameState,
  seed: number,
  limit: number,
  until: (state: GameState) => boolean = finished,
): BotRun {
  let state = start;
  const commands: GameCommand[] = [];
  while (commands.length < limit && !until(state)) {
    const actor = currentActor(state);
    const command =
      actor === null ? null : heuristicBot.nextCommand(state, actor, contextFor(state, seed));
    if (command === null) return { state, commands, stuck: true };
    state = apply(state, command, seed);
    commands.push(command);
  }
  return { state, commands, stuck: false };
}
