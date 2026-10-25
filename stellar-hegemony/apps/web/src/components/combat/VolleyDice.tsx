import type { GameState, Volley } from '@stellar/domain';
import type { ReactElement } from 'react';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { DiceTray } from './DiceTray.tsx';

/** Würfel einer Salve mit Schütze und Trefferzahl; `gated`: der eigene Wurf wartet im Becher. */
export function VolleyDice({
  game,
  volley,
  gated = false,
}: {
  readonly game: GameState;
  readonly volley: Volley;
  readonly gated?: boolean;
}): ReactElement {
  return (
    <div className="volley tabletop-volley">
      <PlayerTag game={game} id={volley.player} />
      <DiceTray volley={volley} gated={gated} />
    </div>
  );
}
