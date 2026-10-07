import { type ReactElement, useMemo, useRef } from 'react';
import { type SlotView, toSlotViews } from '../galaxy-view.ts';
import { boundsOf } from '../hex-geometry.ts';
import { content, useGalaxyStore } from '../store.ts';
import { usePanZoom } from '../use-pan-zoom.ts';
import { HexTile } from './HexTile.tsx';
import { Tooltip } from './Tooltip.tsx';

/** Das hervorgehobene Feld wird zuletzt gezeichnet, damit sein Rahmen oben liegt. */
const orderedForHover = (
  slots: readonly SlotView[],
  hovered: string | null,
): readonly SlotView[] => [
  ...slots.filter((slot) => slot.key !== hovered),
  ...slots.filter((slot) => slot.key === hovered),
];

function useSlotViews() {
  const { layout, language } = useGalaxyStore();
  const slots = useMemo(() => toSlotViews(layout, content, language), [layout, language]);
  const bounds = useMemo(() => boundsOf(slots.map((slot) => slot.position)), [slots]);
  return { slots, bounds };
}

export function GalaxyMap(): ReactElement {
  const { language, hovered, viewport, hover } = useGalaxyStore();
  const { slots, bounds } = useSlotViews();
  const svg = useRef<SVGSVGElement>(null);
  const { cursor, ...handlers } = usePanZoom(svg, bounds.width);
  const hoveredSlot = slots.find((slot) => slot.key === hovered);
  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;
  return (
    <div className="galaxy" {...handlers}>
      <svg ref={svg} viewBox={viewBox} aria-label="galaxy" role="img">
        <g
          transform={`translate(${viewport.panX} ${viewport.panY}) scale(${viewport.zoom})`}
          className="zoom-layer"
        >
          {orderedForHover(slots, hovered).map((slot) => (
            <HexTile
              key={slot.key}
              slot={slot}
              highlighted={slot.key === hovered}
              onHover={hover}
            />
          ))}
        </g>
      </svg>
      {hoveredSlot !== undefined && (
        <Tooltip slot={hoveredSlot} language={language} x={cursor.x} y={cursor.y} />
      )}
    </div>
  );
}
