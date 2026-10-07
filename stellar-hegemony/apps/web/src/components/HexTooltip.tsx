import { unitName } from '@stellar/content';
import { unitTypeId } from '@stellar/domain';
import type { ReactElement } from 'react';
import type { MessageKey } from '../i18n.ts';
import type { SceneHex, ScenePlanet, UnitCount } from '../render/scene-model.ts';
import { seatColor } from '../seat-colors.ts';
import { useLanguage, useT } from '../use-translation.ts';

type Translate = (key: MessageKey) => string;

function SeatDot({ seat }: { readonly seat: number }): ReactElement {
  return <span className="seat-dot" style={{ background: seatColor(seat) }} />;
}

function UnitLine({ unit }: { readonly unit: UnitCount }): ReactElement {
  const language = useLanguage();
  const name = unitName(unitTypeId(unit.type))?.[language] ?? unit.type;
  return (
    <span className="unit-line">
      <SeatDot seat={unit.seat} />
      {unit.count}× {name}
    </span>
  );
}

function PlanetName({ planet, t }: { readonly planet: ScenePlanet; readonly t: Translate }) {
  return (
    <span className="name">
      {planet.controllerSeat !== null && <SeatDot seat={planet.controllerSeat} />}
      {planet.name}
      {planet.exhausted && <em className="exhausted"> ({t('exhausted')})</em>}
    </span>
  );
}

function PlanetRow({
  planet,
  t,
}: {
  readonly planet: ScenePlanet;
  readonly t: Translate;
}): ReactElement {
  const { resources, influence, trait, technologySpecialty } = planet.definition;
  return (
    <div className="tooltip-planet">
      <PlanetName planet={planet} t={t} />
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
      {planet.units.map((unit) => (
        <UnitLine key={`${String(unit.seat)}:${unit.type}`} unit={unit} />
      ))}
    </div>
  );
}

const isEmptySpace = (hex: SceneHex): boolean =>
  hex.planets.length === 0 && hex.anomaly === undefined && hex.wormholes.length === 0;

function TokenLine(props: { readonly seats: readonly number[]; readonly t: Translate }) {
  if (props.seats.length === 0) return null;
  return (
    <div>
      {props.t('commandTokens')}:{' '}
      {props.seats.map((seat) => (
        <SeatDot key={seat} seat={seat} />
      ))}
    </div>
  );
}

function SystemTitle({ hex, t }: { readonly hex: SceneHex; readonly t: Translate }) {
  const home = hex.seat === null ? '' : ` · ${t('homeSystem')} ${t('seat')} ${String(hex.seat)}`;
  return (
    <strong>
      {hex.systemId?.toUpperCase()}
      {home}
    </strong>
  );
}

function SystemDetails({
  hex,
  t,
}: {
  readonly hex: SceneHex;
  readonly t: Translate;
}): ReactElement {
  return (
    <>
      <SystemTitle hex={hex} t={t} />
      {hex.anomaly !== undefined && <div className="tooltip-anomaly">{t(hex.anomaly)}</div>}
      {hex.wormholes.map((kind) => (
        <div key={kind}>
          {t('wormhole')} {kind === 'alpha' ? 'α' : 'β'}
        </div>
      ))}
      {isEmptySpace(hex) && <div>{t('emptySpace')}</div>}
      {hex.planets.map((planet) => (
        <PlanetRow key={planet.id} planet={planet} t={t} />
      ))}
      {hex.ships.map((unit) => (
        <UnitLine key={`${String(unit.seat)}:${unit.type}`} unit={unit} />
      ))}
      <TokenLine seats={hex.tokens} t={t} />
    </>
  );
}

interface HexTooltipProps {
  readonly hex: SceneHex;
  readonly x: number;
  readonly y: number;
}

/** Details zum Feld unter dem Mauszeiger: Planeten, Truppen, Flotten, Marker. */
export function HexTooltip({ hex, x, y }: HexTooltipProps): ReactElement {
  const t = useT();
  return (
    <div className="tooltip glass" role="tooltip" style={{ left: x + 16, top: y + 16 }}>
      {hex.kind === 'homeSlot' ? (
        <strong>
          {t('homeSlot')} · {t('seat')} {hex.seat}
        </strong>
      ) : (
        <SystemDetails hex={hex} t={t} />
      )}
    </div>
  );
}
