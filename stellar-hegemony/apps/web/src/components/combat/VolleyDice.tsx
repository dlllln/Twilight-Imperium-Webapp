import type { GameState, Volley } from '@stellar/domain';
import type { ReactElement } from 'react';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { DiceTray } from './DiceTray.tsx';

/** Würfel einer Salve mit Schütze und Trefferzahl. */
export function VolleyDice({
  game,
  volley,
}: {
  readonly game: GameState;
  readonly volley: Volley;
}): ReactElement {
  return (
    <div className="volley tabletop-volley">
      <PlayerTag game={game} id={volley.player} />
      <DiceTray volley={volley} />
    </div>
  );
}
