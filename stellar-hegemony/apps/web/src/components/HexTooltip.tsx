import { unitName } from '@stellar/content';
import { unitTypeId } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useGameStore } from '../game-store.ts';
import type { MessageKey } from '../i18n.ts';
import type { SceneHex, ScenePlanet, UnitCount } from '../render/scene-model.ts';
import { seatColor } from '../seat-colors.ts';
import { useSettingsStore } from '../settings-store.ts';
import { useLanguage, useT } from '../use-translation.ts';

type Translate = (key: MessageKey) => string;

/** Abstand zum Zeiger und geschätzte Größe des Hinweises, um ihn vom Rand wegzuklappen. */
const OFFSET = 18;
const ESTIMATE = { width: 230, height: 160 };

function SeatDot({ seat }: { readonly seat: number }): ReactElement {
  return <span className="seat-dot" style={{ background: seatColor(seat) }} />;
}

/** Einheiten eines Platzes in einer Zeile: „2 Kreuzer · 1 Träger“. */
function UnitLine({ units }: { readonly units: readonly UnitCount[] }): ReactElement | null {
  const language = useLanguage();
  const first = units[0];
  if (first === undefined) return null;
  const names = units.map(
    (unit) => `${String(unit.count)} ${unitName(unitTypeId(unit.type))?.[language] ?? unit.type}`,
  );
  return (
    <span className="unit-line">
      <SeatDot seat={first.seat} />
      {names.join(' · ')}
    </span>
  );
}

/** Einheiten nach Platz gruppiert, eine Zeile je Spieler. */
function UnitLines({ units }: { readonly units: readonly UnitCount[] }): ReactElement {
  const seats = [...new Set(units.map((unit) => unit.seat))];
  return (
    <>
      {seats.map((seat) => (
        <UnitLine key={seat} units={units.filter((unit) => unit.seat === seat)} />
      ))}
    </>
  );
}

/** Planet in einer Zeile: Besitzer, Name, Ressourcen/Einfluss, Spezialisierung als Punkt. */
function PlanetRow({ planet, t }: { readonly planet: ScenePlanet; readonly t: Translate }) {
  const { resources, influence, technologySpecialty } = planet.definition;
  return (
    <div className={planet.exhausted ? 'tooltip-planet exhausted' : 'tooltip-planet'}>
      <span className="name">
        {planet.controllerSeat !== null && <SeatDot seat={planet.controllerSeat} />}
        {planet.name}
        {technologySpecialty !== undefined && (
          <i
            className={`tech-dot tech-${technologySpecialty}`}
            aria-label={t(technologySpecialty)}
          />
        )}
      </span>
      <span className="values">
        <b className="resources">{resources}</b>/<b className="influence">{influence}</b>
      </span>
      <UnitLines units={planet.units} />
    </div>
  );
}

function SystemTitle({ hex, t }: { readonly hex: SceneHex; readonly t: Translate }) {
  return (
    <strong className="tooltip-title">
      {hex.systemId?.toUpperCase()}
      {hex.seat !== null && <SeatDot seat={hex.seat} />}
      {hex.anomaly !== undefined && <span className="tooltip-anomaly">{t(hex.anomaly)}</span>}
      {hex.wormholes.map((kind) => (
        <span key={kind} className="tooltip-wormhole">
          {kind === 'alpha' ? 'α' : 'β'}
        </span>
      ))}
      {hex.tokens.map((seat) => (
        <SeatDot key={`token-${String(seat)}`} seat={seat} />
      ))}
    </strong>
  );
}

function SystemDetails({ hex, t }: { readonly hex: SceneHex; readonly t: Translate }) {
  return (
    <>
      <SystemTitle hex={hex} t={t} />
      {hex.planets.map((planet) => (
        <PlanetRow key={planet.id} planet={planet} t={t} />
      ))}
      <UnitLines units={hex.ships} />
    </>
  );
}

/** Rechts unten vom Zeiger; nah am Rand klappt der Hinweis auf die andere Seite. */
function placement(x: number, y: number) {
  const width = window.innerWidth || Number.POSITIVE_INFINITY;
  const height = window.innerHeight || Number.POSITIVE_INFINITY;
  const left = x + OFFSET + ESTIMATE.width > width ? x - OFFSET - ESTIMATE.width : x + OFFSET;
  const top = y + OFFSET + ESTIMATE.height > height ? y - OFFSET - ESTIMATE.height : y + OFFSET;
  return { left: Math.max(0, left), top: Math.max(0, top) };
}

interface HexTooltipProps {
  readonly hex: SceneHex;
  readonly x: number;
  readonly y: number;
}

/** Knapper Hinweis zum Feld unter dem Zeiger; die Bedienhilfe nur, bis man einmal geklickt hat. */
export function HexTooltip({ hex, x, y }: HexTooltipProps): ReactElement {
  const t = useT();
  const playing = useGameStore((state) => state.game !== null);
  const hintSeen = useSettingsStore((state) => state.hintSeen);
  return (
    <div className="tooltip glass" role="tooltip" style={placement(x, y)}>
      {hex.kind === 'homeSlot' ? (
        <strong>
          {t('homeSlot')} · {t('seat')} {hex.seat}
        </strong>
      ) : (
        <>
          <SystemDetails hex={hex} t={t} />
          {!hintSeen && (
            <span className="tooltip-hint">{t(playing ? 'systemHintGame' : 'systemHint')}</span>
          )}
        </>
      )}
    </div>
  );
}
