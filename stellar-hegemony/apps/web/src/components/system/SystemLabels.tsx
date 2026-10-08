import type { CSSProperties, ReactElement } from 'react';
import type { Size } from '../../system/use-element-size.ts';
import {
  type Fleet,
  fitScale,
  type PlacedPlanet,
  type SystemLayout,
} from '../../system/system-layout.ts';
import { useT } from '../../use-translation.ts';
import { SeatChip } from './SeatChip.tsx';
import { UnitPill } from './UnitPill.tsx';

/** Abstand der Beschriftung unter dem Planeten bzw. unter der Flotte (Bühneneinheiten). */
const PLANET_LABEL_GAP = 0.66;
const FLEET_LABEL_GAP = 175;

type Project = (x: number, y: number) => CSSProperties;

const projector =
  (size: Size): Project =>
  (x, y) => {
    const scale = fitScale(size.width, size.height);
    return { left: size.width / 2 + x * scale, top: size.height / 2 + y * scale };
  };

function PlanetLabel({ placed, at }: { readonly placed: PlacedPlanet; readonly at: Project }) {
  const t = useT();
  const { planet } = placed;
  return (
    <div
      className="system-label planet-label"
      style={at(placed.x, placed.y + placed.size * PLANET_LABEL_GAP)}
    >
      <strong>{planet.name}</strong>
      <span className="value-pill resources" title={t('resources')}>
        {planet.definition.resources}
      </span>
      <span className="value-pill influence" title={t('influence')}>
        {planet.definition.influence}
      </span>
      {planet.controllerSeat !== null && <SeatChip seat={planet.controllerSeat} />}
    </div>
  );
}

function FleetLabel({ fleet, at }: { readonly fleet: Fleet; readonly at: Project }) {
  return (
    <div className="system-label fleet-label" style={at(fleet.x, fleet.y + FLEET_LABEL_GAP)}>
      <SeatChip seat={fleet.seat} />
      {fleet.counts.map((unit) => (
        <UnitPill key={unit.type} unit={unit} />
      ))}
    </div>
  );
}

/** Beschriftungen über der Pixi-Bühne: gleiche Bühnenkoordinaten, als echtes DOM (lesbar, testbar). */
export function SystemLabels({
  layout,
  size,
}: {
  readonly layout: SystemLayout;
  readonly size: Size;
}): ReactElement {
  const at = projector(size);
  return (
    <div className="system-labels">
      {layout.planets.map((placed) => (
        <PlanetLabel key={placed.planet.id} placed={placed} at={at} />
      ))}
      {layout.fleets.map((fleet) => (
        <FleetLabel key={fleet.seat} fleet={fleet} at={at} />
      ))}
      {layout.wormholes.map((hole) => (
        <div key={hole.kind} className="system-label wormhole-label" style={at(hole.x, hole.y)}>
          {hole.kind === 'alpha' ? 'α' : 'β'}
        </div>
      ))}
    </div>
  );
}
