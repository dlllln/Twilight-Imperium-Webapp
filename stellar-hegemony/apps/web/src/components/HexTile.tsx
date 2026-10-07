import type { AnomalyKind, WormholeKind } from '@stellar/domain';
import type { ReactElement } from 'react';
import type { SlotView, PlanetView } from '../galaxy-view.ts';
import { HEX_SIZE, hexCorners, hexToPixel, type Point, toSvgPoints } from '../hex-geometry.ts';
import { seatColor } from '../seat-colors.ts';

const PLANET_RADIUS = HEX_SIZE * 0.2;
const PLANET_OFFSET = HEX_SIZE * 0.3;
const INNER_SCALE = 0.94;

const planetPositions = (center: Point, count: number): readonly Point[] =>
  count <= 1
    ? [center]
    : [
        { x: center.x - PLANET_OFFSET, y: center.y - PLANET_OFFSET * 0.5 },
        { x: center.x + PLANET_OFFSET, y: center.y + PLANET_OFFSET * 0.5 },
      ];

function Planet({ planet, at }: { readonly planet: PlanetView; readonly at: Point }): ReactElement {
  const { resources, influence, technologySpecialty } = planet.definition;
  return (
    <g className="planet">
      <circle
        cx={at.x}
        cy={at.y}
        r={PLANET_RADIUS}
        className={`planet-body trait-${planet.definition.trait ?? 'none'}`}
      />
      {technologySpecialty !== undefined && (
        <circle
          cx={at.x + PLANET_RADIUS}
          cy={at.y - PLANET_RADIUS}
          r={4}
          className={`tech tech-${technologySpecialty}`}
        />
      )}
      <text x={at.x} y={at.y + PLANET_RADIUS + 11} className="planet-values">
        <tspan className="resources">{resources}</tspan>
        <tspan className="separator"> · </tspan>
        <tspan className="influence">{influence}</tspan>
      </text>
    </g>
  );
}

function Anomaly({ kind, at }: { readonly kind: AnomalyKind; readonly at: Point }): ReactElement {
  return <circle cx={at.x} cy={at.y} r={HEX_SIZE * 0.55} className={`anomaly anomaly-${kind}`} />;
}

function Wormhole({ kind, at }: { readonly kind: WormholeKind; readonly at: Point }): ReactElement {
  const position = { x: at.x + HEX_SIZE * 0.45, y: at.y - HEX_SIZE * 0.45 };
  return (
    <g className={`wormhole wormhole-${kind}`}>
      <circle cx={position.x} cy={position.y} r={11} />
      <text x={position.x} y={position.y + 5}>
        {kind === 'alpha' ? 'α' : 'β'}
      </text>
    </g>
  );
}

function SystemContent({
  slot,
  center,
}: {
  readonly slot: Extract<SlotView, { kind: 'system' }>;
  readonly center: Point;
}): ReactElement {
  const positions = planetPositions(center, slot.planets.length);
  return (
    <>
      {slot.anomaly !== undefined && <Anomaly kind={slot.anomaly} at={center} />}
      {slot.planets.map((planet, index) => (
        <Planet key={planet.definition.id} planet={planet} at={positions[index] ?? center} />
      ))}
      {slot.wormholes.map((kind) => (
        <Wormhole key={kind} kind={kind} at={center} />
      ))}
      <text x={center.x} y={center.y + HEX_SIZE * 0.78} className="tile-label">
        {slot.tileId}
      </text>
    </>
  );
}

function HomeMarker({ seat, at }: { readonly seat: number; readonly at: Point }): ReactElement {
  return (
    <text x={at.x} y={at.y + 6} className="home-label" style={{ fill: seatColor(seat) }}>
      {seat}
    </text>
  );
}

export interface HexTileProps {
  readonly slot: SlotView;
  readonly highlighted: boolean;
  readonly onHover: (key: string | null) => void;
}

export function HexTile({ slot, highlighted, onHover }: HexTileProps): ReactElement {
  const center = hexToPixel(slot.position);
  const tileClass = slot.kind === 'home' ? 'tile-home' : `tile-${slot.back}`;
  return (
    <g
      className={`hex ${tileClass}${highlighted ? ' highlighted' : ''}`}
      data-slot={slot.key}
      onPointerEnter={() => onHover(slot.key)}
      onPointerLeave={() => onHover(null)}
    >
      <polygon points={toSvgPoints(hexCorners(center))} className="hex-frame" />
      <polygon
        points={toSvgPoints(hexCorners(center, HEX_SIZE * INNER_SCALE))}
        className="hex-face"
        style={slot.kind === 'home' ? { stroke: seatColor(slot.seat) } : undefined}
      />
      {slot.kind === 'home' ? (
        <HomeMarker seat={slot.seat} at={center} />
      ) : (
        <SystemContent slot={slot} center={center} />
      )}
    </g>
  );
}
