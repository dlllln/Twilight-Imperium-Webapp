import { SIMULATOR_RULES } from '@stellar/content';
import type { ReactElement } from 'react';
import { RIVAL, YOU } from '../../simulator/simulator-rules.ts';
import { useSimulatorStore } from '../../simulator/simulator-store.ts';
import { useT } from '../../use-translation.ts';

const pipClass = (outcome: unknown): string => {
  if (outcome === YOU) return 'pip won';
  if (outcome === RIVAL) return 'pip lost';
  return outcome === 'draw' ? 'pip drawn' : 'pip';
};

/** Punkte für die Kämpfe der Serie: gewonnen, verloren, unentschieden, offen. */
export function SeriesPips(): ReactElement {
  const t = useT();
  const results = useSimulatorStore((state) => state.results);
  return (
    <div className="series-pips">
      <span>{t('combats')}</span>
      <ol aria-label={t('combats')}>
        {Array.from({ length: SIMULATOR_RULES.battles }, (_, index) => (
          <li
            key={index}
            className={
              index === results.length
                ? `${pipClass(results[index])} current`
                : pipClass(results[index])
            }
          />
        ))}
      </ol>
    </div>
  );
}
