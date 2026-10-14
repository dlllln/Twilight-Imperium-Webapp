import { SIMULATOR_RULES, SIMULATOR_SHIPS } from '@stellar/content';
import {
  costOf,
  type FleetSummary,
  summarizeFleet,
  type UnitDefinition,
  type UnitTypeId,
  validateFleet,
} from '@stellar/domain';
import { ChevronLeft, Factory, Minus, Plus, Swords } from 'lucide-react';
import type { ReactElement } from 'react';
import { UnitArtwork } from '../../artwork/UnitArtwork.tsx';
import { errorText } from '../../i18n.ts';
import { unitLabel } from '../../labels.ts';
import { catalogFor, seatOf, YOU } from '../../simulator/simulator-rules.ts';
import { useSimulatorStore } from '../../simulator/simulator-store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { SeriesPips } from './SeriesPips.tsx';

function Stat({
  label,
  value,
  limit,
}: {
  readonly label: string;
  readonly value: number;
  readonly limit: number;
}) {
  return (
    <div className={value > limit ? 'fleet-stat over' : 'fleet-stat'}>
      <span>{label}</span>
      <strong>
        {value}/{limit}
      </strong>
    </div>
  );
}

function FleetStats({ summary }: { readonly summary: FleetSummary }): ReactElement {
  const t = useT();
  return (
    <div className="fleet-stats">
      <Stat
        label={t('simProductionLimit')}
        value={summary.units}
        limit={SIMULATOR_RULES.productionLimit}
      />
      <Stat label={t('resources')} value={summary.cost} limit={SIMULATOR_RULES.budget} />
      <Stat label={t('capacityLabel')} value={summary.fighters} limit={summary.capacity} />
    </div>
  );
}

function Stepper({ type, count }: { readonly type: UnitTypeId; readonly count: number }) {
  const t = useT();
  const setCount = useSimulatorStore((state) => state.setCount);
  return (
    <div className="stepper">
      <button
        type="button"
        aria-label={t('fewer')}
        disabled={count === 0}
        onClick={() => setCount(type, count - 1)}
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <output aria-live="polite">{count}</output>
      <button type="button" aria-label={t('more')} onClick={() => setCount(type, count + 1)}>
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Kosten je Kauf, Einheiten je Kauf und Kampfwert einer Schiffsart. */
function factsOf(definition: UnitDefinition | undefined) {
  return {
    cost: definition === undefined ? 0 : costOf(definition, 1),
    hitOn: definition?.combat?.hitOn,
    per: definition?.cost?.unitsPerCost ?? 1,
  };
}

/** Kosten und Kampfwert, z. B. „Kosten 2 · 7+“. */
function ShipFacts({ type }: { readonly type: UnitTypeId }): ReactElement {
  const t = useT();
  const { faction, rival } = useSimulatorStore();
  const { cost, hitOn, per } = factsOf(catalogFor(faction, rival).find(type, YOU));
  return (
    <p className="ship-cost">
      {t('cost')} {cost}
      {per > 1 && ` (${String(per)}×)`}
      {hitOn !== undefined && ` · ${String(hitOn)}+`}
    </p>
  );
}

function ShipCard({ type }: { readonly type: UnitTypeId }): ReactElement {
  const t = useT();
  const language = useLanguage();
  const { order, faction, rival } = useSimulatorStore();
  const limit = catalogFor(faction, rival).find(type, YOU)?.componentLimit ?? 0;
  const count = order[type] ?? 0;
  const name = unitLabel(type, language);
  return (
    <li className="ship-card" aria-label={name}>
      <h3>{name}</h3>
      <p className="ship-owned">
        {t('owned')}: {count}/{limit === 'unlimited' ? '∞' : limit}
      </p>
      <UnitArtwork type={type} seat={seatOf(YOU)} large />
      <ShipFacts type={type} />
      <Stepper type={type} count={count} />
    </li>
  );
}

function FleetActions({ error }: { readonly error: string | null }): ReactElement {
  const t = useT();
  const language = useLanguage();
  const { back, launch } = useSimulatorStore();
  return (
    <footer className="sim-actions">
      <p className="sim-error" role="status">
        {error === null ? '' : errorText(language, error)}
      </p>
      <button type="button" className="hex-button" onClick={back}>
        <ChevronLeft size={16} aria-hidden="true" /> {t('back')}
      </button>
      <button
        type="button"
        className="hex-button primary"
        disabled={error !== null}
        onClick={launch}
      >
        <Swords size={16} aria-hidden="true" /> {t('toBattle')}
      </button>
    </footer>
  );
}

/** Zweiter Schritt: Schiffe kaufen wie in einer Werft, mit Limit, Ressourcen und Kapazität. */
export function FleetBuilder(): ReactElement {
  const t = useT();
  const { order, faction, rival } = useSimulatorStore();
  const catalog = catalogFor(faction, rival);
  const valid = validateFleet(order, catalog, YOU, SIMULATOR_RULES);
  return (
    <div className="sim-panel sim-fleet">
      <header className="sim-fleet-head">
        <h2 className="sim-title">
          <Factory size={22} aria-hidden="true" /> {t('buildFleet')}
        </h2>
        <SeriesPips />
      </header>
      <FleetStats summary={summarizeFleet(order, catalog, YOU)} />
      <ul className="ship-cards">
        {SIMULATOR_SHIPS.map((type) => (
          <ShipCard key={type} type={type} />
        ))}
      </ul>
      <FleetActions error={valid.ok ? null : valid.error.code} />
    </div>
  );
}
