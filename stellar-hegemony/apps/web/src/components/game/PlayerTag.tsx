import { findPlayer, type GameState, type PlayerId } from '@stellar/domain';
import type { ReactElement } from 'react';
import { seatColor } from '../../seat-colors.ts';

export function PlayerTag({
  game,
  id,
}: {
  readonly game: GameState;
  readonly id: PlayerId | null;
}): ReactElement | null {
  const player = id === null ? undefined : findPlayer(game, id);
  if (player === undefined) return null;
  return (
    <span className="player-tag">
      <span className="swatch" style={{ background: seatColor(player.seat + 1) }} />
      {player.name}
    </span>
  );
}
