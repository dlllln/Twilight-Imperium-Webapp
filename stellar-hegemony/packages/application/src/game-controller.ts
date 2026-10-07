import {
  andThen,
  type ClockPort,
  type ContentPort,
  createGameHandler,
  type CreateGame,
  type DecisionContext,
  decideGameCommand,
  type DomainError,
  evolveGame,
  type GameCommand,
  type GameEvent,
  type GameId,
  type GameState,
  ok,
  type RandomPort,
  replayGame,
  type Result,
} from '@stellar/domain';
import type { EventPublisherPort } from './event-publisher-port.ts';
import type { EventStorePort } from './event-store-port.ts';

export interface GameControllerPorts {
  readonly store: EventStorePort;
  readonly publisher: EventPublisherPort;
  readonly random: RandomPort;
  readonly clock: ClockPort;
  readonly content: ContentPort;
}

export interface CommandOutcome {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * GRASP Controller: nimmt Commands für eine Partie entgegen, lädt den Zustand
 * aus dem Event Store, lässt die Domain entscheiden und speichert die Events.
 */
export class GameController {
  /** Zuletzt bekannter Zustand je Partie; nach einem Neustart baut `load` ihn aus den Events neu. */
  private readonly cache = new Map<GameId, GameState>();

  constructor(private readonly ports: GameControllerPorts) {}

  /** Zufall, Zeit und Inhalte für eine Entscheidung (auch für KI-Gegner). */
  context(): DecisionContext {
    const { random, clock, content } = this.ports;
    return { random, now: clock.now(), content };
  }

  async create(command: CreateGame): Promise<Result<CommandOutcome, DomainError>> {
    const decided = andThen(createGameHandler.decide(null, command), (events) =>
      andThen(replayGame(events), (state) => ok({ state, events })),
    );
    if (!decided.ok) return decided;
    return this.persist(command.gameId, 0, decided.value);
  }

  async execute(
    gameId: GameId,
    command: GameCommand,
  ): Promise<Result<CommandOutcome, DomainError>> {
    const state = await this.load(gameId);
    if (!state.ok) return state;
    const decided = decideGameCommand(state.value, command, this.context());
    if (!decided.ok) return decided;
    const next = decided.value.reduce(evolveGame, state.value);
    return this.persist(gameId, state.value.version, { state: next, events: decided.value });
  }

  async load(gameId: GameId): Promise<Result<GameState, DomainError>> {
    const cached = this.cache.get(gameId);
    if (cached !== undefined) return ok(cached);
    return replayGame(await this.ports.store.load(gameId));
  }

  private async persist(
    gameId: GameId,
    expectedVersion: number,
    outcome: CommandOutcome,
  ): Promise<Result<CommandOutcome, DomainError>> {
    const appended = await this.ports.store.append(gameId, expectedVersion, outcome.events);
    if (!appended.ok) {
      this.cache.delete(gameId);
      return appended;
    }
    this.cache.set(gameId, outcome.state);
    this.ports.publisher.publish(gameId, outcome.events, outcome.state);
    return ok(outcome);
  }
}
