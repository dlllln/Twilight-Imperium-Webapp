import type { ReactElement } from 'react';
import type { PlanetView, SlotView } from '../galaxy-view.ts';
import { type Language, type MessageKey, translate } from '../i18n.ts';

type Translate = (key: MessageKey) => string;
type SystemSlot = Extract<SlotView, { kind: 'system' }>;

interface TooltipProps {
  readonly slot: SlotView;
  readonly language: Language;
  readonly x: number;
  readonly y: number;
}

function PlanetRow({
  planet,
  t,
}: {
  readonly planet: PlanetView;
  readonly t: Translate;
}): ReactElement {
  const { resources, influence, trait, technologySpecialty } = planet.definition;
  return (
    <div className="tooltip-planet">
      <span className="name">{planet.name}</span>
      <span className="resources" title={t('resources')}>
        {resources}
      </span>
      <span className="influence" title={t('influence')}>
        {influence}
      </span>
      {trait !== undefined && <span className="trait">{t(trait)}</span>}
      {technologySpecialty !== undefined && (
        <span className={`tech-label tech-${technologySpecialty}`}>{t(technologySpecialty)}</span>
      )}
    </div>
  );
}

const isEmptySpace = (slot: SystemSlot): boolean =>
  slot.planets.length === 0 && slot.anomaly === undefined && slot.wormholes.length === 0;

function SystemDetails({
  slot,
  t,
}: {
  readonly slot: SystemSlot;
  readonly t: Translate;
}): ReactElement {
  return (
    <>
      <strong>{slot.tileId}</strong>
      {slot.anomaly !== undefined && <div className="tooltip-anomaly">{t(slot.anomaly)}</div>}
      {slot.wormholes.map((kind) => (
        <div key={kind}>
          {t('wormhole')} {kind === 'alpha' ? 'α' : 'β'}
        </div>
      ))}
      {isEmptySpace(slot) && <div>{t('emptySpace')}</div>}
      {slot.planets.map((planet) => (
        <PlanetRow key={planet.definition.id} planet={planet} t={t} />
      ))}
    </>
  );
}

export function Tooltip({ slot, language, x, y }: TooltipProps): ReactElement {
  const t: Translate = (key) => translate(language, key);
  return (
    <div className="tooltip glass" role="tooltip" style={{ left: x + 16, top: y + 16 }}>
      {slot.kind === 'home' ? (
        <strong>
          {t('homeSlot')} · {t('seat')} {slot.seat}
        </strong>
      ) : (
        <SystemDetails slot={slot} t={t} />
      )}
    </div>
  );
}
