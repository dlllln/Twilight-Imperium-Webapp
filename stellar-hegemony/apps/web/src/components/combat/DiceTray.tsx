import type { UnitRoll, Volley } from '@stellar/domain';
import type { CSSProperties, ReactElement } from 'react';
import { unitLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { type DiceReveal, useDiceReveal } from './use-dice-reveal.ts';
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

/** Ein Würfel im Becher: zehnseitig, aber ohne Zahl; das Ergebnis steht erst nach dem Wurf fest. */
function CuppedDie({ order }: { readonly order: number }): ReactElement {
  return (
    <span
      className="die tabletop-die cupped"
      aria-hidden="true"
      style={{ '--die-order': Math.min(order, 7) } as CSSProperties}
    />
  );
}

const diceOf = (volley: Volley) =>
  volley.rolls.flatMap((roll) => roll.results.map((result, index) => ({ roll, result, index })));

function DiceResults({ volley, held }: { readonly volley: Volley; readonly held: boolean }) {
  return (
    <span className="dice tabletop-dice">
      {diceOf(volley).map(({ roll, result, index }, order) =>
        held ? (
          <CuppedDie key={`${roll.unit}-${index}`} order={order} />
        ) : (
          <Die key={`${roll.unit}-${index}`} roll={roll} result={result} order={order} />
        ),
      )}
    </span>
  );
}

/** Ergebnis der Salve, solange die Würfel liegen; im Becher nur „Würfeln“. */
function TrayResult({ volley, reveal }: { readonly volley: Volley; readonly reveal: DiceReveal }) {
  const t = useT();
  const language = useLanguage();
  if (reveal.held)
    return (
      <div className="dice-tray-result">
        <span className="volley-cup">{t('diceInCup')}</span>
        <button type="button" className="dice-roll" onClick={reveal.roll}>
          {t('rollDice')}
        </button>
      </div>
    );
  return (
    <div className="dice-tray-result">
      <strong className="volley-hits" aria-live="polite">
        {volley.hits} {t('hits')}
      </strong>
      {reveal.rolling && (
        <button type="button" className="dice-reveal" onClick={reveal.finish}>
          {language === 'de' ? 'Ergebnis zeigen' : 'Show result'}
        </button>
      )}
    </div>
  );
}

/**
 * Gemeinsame Würfelschale für echte Kämpfe und den Simulator, mit sofortiger Aufdeckung. Mit
 * `gated` liegt der eigene Wurf am Tisch zuerst im Becher, bis „Würfeln“ ihn wirft.
 */
export function DiceTray(props: { readonly volley: Volley; readonly gated?: boolean }) {
  const language = useLanguage();
  const reveal = useDiceReveal(props.volley, props.gated);
  return (
    <div
      className="dice-tray"
      data-rolling={reveal.rolling}
      data-held={reveal.held || undefined}
      role="group"
      aria-label={language === 'de' ? 'Würfelschale' : 'Dice tray'}
    >
      <DiceResults volley={props.volley} held={reveal.held} />
      <TrayResult volley={props.volley} reveal={reveal} />
    </div>
  );
}
