import type { ReactElement, ReactNode } from 'react';
import type { ResearchCard, ResearchSpread } from '../../table/spec-research.ts';
import type { Shipyard } from '../../table/shipyard.ts';
import { technologyLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';

/*
 * Messleisten der Ansage für Werft und Forschungsauslage, dazu die gemeinsame Zeile. Die Zahlen
 * kommen aus Werft bzw. Auslage (also aus der Domain), der bezahlte Wert aus der Planetenreihe.
 */

/** Die Messleiste ist eine Live-Region: Bildschirmleser hören jede Änderung. */
export function MeterLine({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <p className="table-prompt-meter" aria-live="polite" aria-atomic="true">
      {children}
    </p>
  );
}

/** „bezahlt / benötigt“ in Ressourcen; nur solange etwas zu bezahlen ist. */
function PaidPart({ paid, needed }: { readonly paid: number | null; readonly needed: number }) {
  const t = useT();
  if (needed <= 0) return null;
  return (
    <>
      {' · '}
      <span>
        {t('resources')}: <strong data-testid="paid">{paid ?? 0}</strong> / {needed}
      </span>
    </>
  );
}

export interface ProductionMeterProps {
  readonly yard: Shipyard;
  /** Wert der Bezahlung laut Domain; `null`, solange nichts zu bezahlen ist. */
  readonly paid: number | null;
}

/** Werft: Einheiten im Dock / Produktionswert, Kosten, Bezahlung und die Blockade. */
export function ProductionMeter({ yard, paid }: ProductionMeterProps): ReactElement {
  const t = useT();
  const { count, limit, cost } = yard.quote;
  return (
    <>
      <MeterLine>
        <span>
          {t('dockCount')}: <strong data-testid="dock-count">{count}</strong> / {limit}
        </span>
        {' · '}
        <span>
          {t('cost')}: <strong data-testid="production-cost">{cost}</strong>
        </span>
        <PaidPart paid={paid} needed={cost} />
      </MeterLine>
      {yard.blockaded && <p className="warning table-prompt-warning">{t('blockaded')}</p>}
    </>
  );
}

export interface ResearchMeterProps {
  readonly spread: ResearchSpread;
  readonly paid: number | null;
}

/**
 * Eine gewählte Karte ohne erfüllte Voraussetzungen: Name und fehlende Farben in der Messleiste,
 * damit auch Bildschirmleser hören, warum das Siegel zu bleibt.
 */
function UnmetPart({ unmet }: { readonly unmet: readonly ResearchCard[] }) {
  const t = useT();
  const language = useLanguage();
  const first = unmet[0];
  if (first === undefined) return null;
  const colors = first.missing.map((color) => t(color)).join(', ');
  const text = t('researchUnmet')
    .replace('{technology}', technologyLabel(first.technology.id, language))
    .replace('{colors}', colors);
  return (
    <span className="table-prompt-chosen table-prompt-unmet" data-testid="research-unmet">
      {text}
    </span>
  );
}

/** Forschung: gewählte Technologien / erlaubte, Bezahlung und eine überflüssige Spezialisierung. */
export function ResearchMeter({ spread, paid }: ResearchMeterProps): ReactElement {
  const t = useT();
  return (
    <>
      <MeterLine>
        <span>
          {t('researchChosen')}: <strong data-testid="research-count">{spread.count}</strong> /{' '}
          {spread.max}
        </span>
        <PaidPart paid={paid} needed={spread.required} />
        <UnmetPart unmet={spread.unmet} />
      </MeterLine>
      {spread.unusedSpecialty && (
        <p className="warning table-prompt-warning">{t('specialtyUnused')}</p>
      )}
    </>
  );
}
