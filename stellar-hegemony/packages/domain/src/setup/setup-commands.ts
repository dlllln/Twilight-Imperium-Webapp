import type { Command, CommandHandler } from '../eventsourcing/command.ts';
import { validateGameConfig, type GameConfig } from '../game/game-config.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlayerColor } from '../player/player-state.ts';
import { type Check, type DomainError, firstFailure, guard } from '../shared/domain-error.ts';
import type { FactionId, GameId, PlayerId } from '../shared/ids.ts';
import { map, ok, type Result } from '../shared/result.ts';
import type { GameCreated, PlayerSeated } from './setup-events.ts';

export interface CreateGame extends Command<'CreateGame'> {
  readonly gameId: GameId;
  readonly config: GameConfig;
}

export interface SeatPlayer extends Command<'SeatPlayer'> {
  readonly name: string;
  readonly color: PlayerColor;
  readonly faction: FactionId;
  readonly commodityLimit: number;
}

/** Erzeugt das erste Event einer Partie. Der Zustand vor der Erstellung wird ignoriert. */
export const createGameHandler = {
  commandType: 'CreateGame',
  decide(
    _state: GameState | null,
    command: CreateGame,
  ): Result<readonly GameCreated[], DomainError> {
    return map(validateGameConfig(command.config), (config) => [
      { type: 'GameCreated', gameId: command.gameId, config },
    ]);
  },
} as const satisfies CommandHandler<GameState | null, CreateGame, GameCreated>;

function seatingChecks(state: GameState, command: SeatPlayer): readonly Check[] {
  const players = state.players;
  return [
    guard(state.phase === 'setup', 'setup.notInSetup', 'Partie läuft bereits'),
    guard(players.length < state.config.playerCount, 'setup.full', 'Alle Plätze belegt'),
    guard(
      !players.some((p) => p.id === command.issuedBy),
      'setup.alreadySeated',
      'Spieler sitzt bereits',
    ),
    guard(!players.some((p) => p.color === command.color), 'setup.colorTaken', 'Farbe vergeben'),
    guard(
      !players.some((p) => p.faction === command.faction),
      'setup.factionTaken',
      'Fraktion vergeben',
    ),
    guard(command.name.trim().length > 0, 'setup.nameMissing', 'Name fehlt'),
  ];
}

export const seatPlayerHandler = {
  commandType: 'SeatPlayer',
  decide(state: GameState, command: SeatPlayer): Result<readonly PlayerSeated[], DomainError> {
    const checks = firstFailure(seatingChecks(state, command));
    if (!checks.ok) return checks;
    return ok([seatedEvent(command.issuedBy, command)]);
  },
} as const satisfies CommandHandler<GameState, SeatPlayer, PlayerSeated>;

function seatedEvent(playerId: PlayerId, command: SeatPlayer): PlayerSeated {
  return {
    type: 'PlayerSeated',
    playerId,
    name: command.name.trim(),
    color: command.color,
    faction: command.faction,
    commodityLimit: command.commodityLimit,
  };
}
