import type { DomainEvent } from '../eventsourcing/domain-event.ts';
import type { GameConfig } from '../game/game-config.ts';
import type { FactionId, GameId, PlayerId } from '../shared/ids.ts';
import type { PlayerColor } from '../player/player-state.ts';

export interface GameCreated extends DomainEvent<'GameCreated'> {
  readonly gameId: GameId;
  readonly config: GameConfig;
}

export interface PlayerSeated extends DomainEvent<'PlayerSeated'> {
  readonly playerId: PlayerId;
  readonly name: string;
  readonly color: PlayerColor;
  readonly faction: FactionId;
  readonly commodityLimit: number;
}

export type SetupEvent = GameCreated | PlayerSeated;
