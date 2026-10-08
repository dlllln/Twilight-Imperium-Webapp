import type { ReactElement } from 'react';
import type { Fleet, SystemLayout } from '../../system/system-layout.ts';
import type { ScenePlanet } from '../../render/scene-model.ts';
import { useT } from '../../use-translation.ts';
import { SeatChip } from './SeatChip.tsx';
import { UnitPill } from './UnitPill.tsx';

function PlanetTags({ planet }: { readonly planet: ScenePlanet }): ReactElement {
  const t = useT();
  const { trait, technologySpecialty } = planet.definition;
  return (
    <div className="card-tags">
      {trait !== undefined && <span className="tag">{t(trait)}</span>}
      {technologySpecialty !== undefined && (
        <span className={`tag tech-${technologySpecialty}`}>{t(technologySpecialty)}</span>
      )}
      {planet.exhausted && <span className="tag">{t('exhausted')}</span>}
      {planet.controllerSeat === null ? (
        <span className="tag muted">{t('uncontrolled')}</span>
      ) : (
        <SeatChip seat={planet.controllerSeat} />
      )}
    </div>
  );
}

function PlanetCard({ planet }: { readonly planet: ScenePlanet }): ReactElement {
  const t = useT();
  const { resources, influence } = planet.definition;
  return (
    <li className={planet.exhausted ? 'system-card exhausted' : 'system-card'}>
      <div className="card-head">
        <span className="card-kind">{t('planets')}</span>
        <strong>{planet.name}</strong>
        <span className="value-pill resources" title={t('resources')}>
          {resources}
        </span>
        <span className="value-pill influence" title={t('influence')}>
          {influence}
        </span>
      </div>
      <PlanetTags planet={planet} />
      {planet.units.length > 0 && (
        <div className="unit-row" aria-label={t('groundForces')}>
          {planet.units.map((unit) => (
            <UnitPill key={`${String(unit.seat)}:${unit.type}`} unit={unit} />
          ))}
        </div>
      )}
    </li>
  );
}

function FleetCard({ fleet }: { readonly fleet: Fleet }): ReactElement {
  const t = useT();
  return (
    <li className="system-card">
      <div className="card-head">
        <span className="card-kind">{t('fleets')}</span>
        <SeatChip seat={fleet.seat} />
      </div>
      <div className="unit-row">
        {fleet.counts.map((unit) => (
          <UnitPill key={unit.type} unit={unit} />
        ))}
      </div>
    </li>
  );
}

/** Was im System steht, als Kartenleiste unter der Bühne: Flotten je Spieler, dann Planeten. */
export function SystemContents({ layout }: { readonly layout: SystemLayout }): ReactElement {
  const t = useT();
  return (
    <ul className="system-contents glass" aria-label={t('inSystem')}>
      {layout.fleets.length === 0 && (
        <li className="system-card muted">
          <span className="card-kind">{t('fleets')}</span>
          {t('noFleets')}
        </li>
      )}
      {layout.fleets.map((fleet) => (
        <FleetCard key={fleet.seat} fleet={fleet} />
      ))}
      {layout.planets.map(({ planet }) => (
        <PlanetCard key={planet.id} planet={planet} />
      ))}
    </ul>
  );
}
