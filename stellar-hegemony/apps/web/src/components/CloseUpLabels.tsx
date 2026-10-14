import type { ReactElement } from 'react';
import type { Bounds } from '../hex-geometry.ts';
import type { SceneHex, ScenePlanet } from '../render/scene-model.ts';
import type { Viewport } from '../store.ts';
import type { BoardView } from '../render/board-view.ts';
import { type CloseUpMark, closeUpMarks } from '../system/close-up.ts';
import type { Size } from '../system/use-element-size.ts';
import { useT } from '../use-translation.ts';
import { SeatChip } from './system/SeatChip.tsx';
import { UnitPill } from './system/UnitPill.tsx';

function PlanetTags({ planet }: { readonly planet: ScenePlanet }): ReactElement {
  const t = useT();
  const { trait, technologySpecialty } = planet.definition;
  return (
    <>
      {trait !== undefined && <span className="tag">{t(trait)}</span>}
      {technologySpecialty !== undefined && (
        <span className={`tag tech-${technologySpecialty}`}>{t(technologySpecialty)}</span>
      )}
      {planet.exhausted && <span className="tag">{t('exhausted')}</span>}
      {planet.legendary !== null && <span className="tag legendary">{t('legendaryKind')}</span>}
      {planet.attachments.length > 0 && (
        <span className="tag">
          {t('attachment')} ×{planet.attachments.length}
        </span>
      )}
      {planet.controllerSeat !== null && <SeatChip seat={planet.controllerSeat} />}
    </>
  );
}

function PlanetSign({ planet }: { readonly planet: ScenePlanet }): ReactElement {
  const t = useT();
  return (
    <>
      <div className="close-up-head">
        <strong>{planet.name}</strong>
        <span className="value-pill resources" title={t('resources')}>
          {planet.definition.resources}
        </span>
        <span className="value-pill influence" title={t('influence')}>
          {planet.definition.influence}
        </span>
      </div>
      <div className="close-up-tags">
        <PlanetTags planet={planet} />
        {planet.units.map((unit) => (
          <UnitPill key={`${String(unit.seat)}:${unit.type}`} unit={unit} />
        ))}
      </div>
    </>
  );
}

function Sign({ mark }: { readonly mark: CloseUpMark }): ReactElement {
  const style = { left: mark.at.x, top: mark.at.y };
  if (mark.kind === 'planet')
    return (
      <li className="close-up-sign planet-sign" style={style}>
        <PlanetSign planet={mark.planet} />
      </li>
    );
  return (
    <li className="close-up-sign fleet-sign" style={style}>
      <SeatChip seat={mark.seat} />
      {mark.units.map((unit) => (
        <UnitPill key={unit.type} unit={unit} />
      ))}
    </li>
  );
}

interface Props {
  readonly hexes: readonly SceneHex[];
  readonly bounds: Bounds;
  readonly viewport: Viewport;
  readonly view: BoardView;
  readonly size: Size;
}

/** Schilder unter Planeten und Flotten beim Nahzoom: echtes DOM, scharf und lesbar. */
export function CloseUpLabels({ hexes, bounds, viewport, view, size }: Props): ReactElement | null {
  const t = useT();
  const marks = closeUpMarks(hexes, bounds, size, viewport, view);
  if (marks.length === 0) return null;
  return (
    <ul className="close-up-labels" aria-label={t('closeUp')}>
      {marks.map((mark) => (
        <Sign key={mark.key} mark={mark} />
      ))}
    </ul>
  );
}
