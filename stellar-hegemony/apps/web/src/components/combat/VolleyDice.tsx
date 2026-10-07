import type { GameState, UnitRoll, Volley } from '@stellar/domain';
import type { CSSProperties, ReactElement } from 'react';
import { unitLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';

interface DieProps {
  readonly roll: UnitRoll;
  readonly result: number;
  /** Reihenfolge in der Salve; die Würfel rollen nacheinander aus. */
  readonly order: number;
}

/** Ein Würfel: zeigt das Ergebnis, Treffer leuchten. */
function Die({ roll, result, order }: DieProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <span
      className={result >= roll.hitOn ? 'die hit' : 'die'}
      style={{ '--i': order } as CSSProperties}
      title={`${unitLabel(roll.type, language)}: ${t('hitOn')} ${String(roll.hitOn)}`}
    >
      {result}
    </span>
  );
}

/** Würfel einer Salve mit Schütze und Trefferzahl. */
export function VolleyDice({
  game,
  volley,
}: {
  readonly game: GameState;
  readonly volley: Volley;
}): ReactElement {
  const t = useT();
  return (
    <div className="volley">
      <PlayerTag game={game} id={volley.player} />
      <span className="dice">
        {volley.rolls
          .flatMap((roll) => roll.results.map((result, index) => ({ roll, result, index })))
          .map(({ roll, result, index }, order) => (
            <Die key={`${roll.unit}-${String(index)}`} roll={roll} result={result} order={order} />
          ))}
      </span>
      <strong className="volley-hits">
        {volley.hits} {t('hits')}
      </strong>
    </div>
  );
}
