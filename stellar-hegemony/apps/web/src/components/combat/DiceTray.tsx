import type { UnitRoll, Volley } from '@stellar/domain';
import type { CSSProperties, ReactElement } from 'react';
import { unitLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { useDiceReveal } from './use-dice-reveal.ts';
import './dice-tray.css';

interface DieProps {
  readonly roll: UnitRoll;
  readonly result: number;
  readonly order: number;
}

/** Zehnseitiger Spielwürfel: ausschließlich das vom Spiel gelieferte Ergebnis. */
function Die({ roll, result, order }: DieProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const hit = result >= roll.hitOn;
  const outcome = language === 'de' ? ['Fehlschlag', 'Treffer'] : ['Miss', 'Hit'];
  const label = `${unitLabel(roll.type, language)}: ${result} · ${t('hitOn')} ${roll.hitOn} · ${outcome[Number(hit)] ?? ''}`;
  return (
    <span
      className={`die tabletop-die ${hit ? 'hit' : 'miss'}`}
      role="img"
      aria-label={label}
      title={label}
      style={{ '--die-order': Math.min(order, 7) } as CSSProperties}
    >
      <span className="tabletop-die-face" aria-hidden="true">
        {result}
      </span>
      <span className="tabletop-die-mark" aria-hidden="true">
        {hit ? '✓' : '×'}
      </span>
    </span>
  );
}

function DiceResults({ volley }: { readonly volley: Volley }): ReactElement {
  return (
    <span className="dice tabletop-dice">
      {volley.rolls
        .flatMap((roll) => roll.results.map((result, index) => ({ roll, result, index })))
        .map(({ roll, result, index }, order) => (
          <Die key={`${roll.unit}-${index}`} roll={roll} result={result} order={order} />
        ))}
    </span>
  );
}

/** Gemeinsame Würfelschale für echte Kämpfe und den Simulator, mit sofortiger Aufdeckung. */
export function DiceTray({ volley }: { readonly volley: Volley }): ReactElement {
  const t = useT();
  const language = useLanguage();
  const { rolling, finish } = useDiceReveal(volley);
  return (
    <div
      className="dice-tray"
      data-rolling={rolling}
      role="group"
      aria-label={language === 'de' ? 'Würfelschale' : 'Dice tray'}
    >
      <DiceResults volley={volley} />
      <div className="dice-tray-result">
        <strong className="volley-hits" aria-live="polite">
          {volley.hits} {t('hits')}
        </strong>
        {rolling && (
          <button type="button" className="dice-reveal" onClick={finish}>
            {language === 'de' ? 'Ergebnis zeigen' : 'Show result'}
          </button>
        )}
      </div>
    </div>
  );
}
