import type { MapPing } from '@stellar/application';
import type { CSSProperties, ReactElement } from 'react';
import { type Bounds, hexToPixel } from '../hex-geometry.ts';
import { useMapPingStore } from '../online/map-ping-store.ts';
import { type BoardView, project } from '../render/board-view.ts';
import type { SceneHex } from '../render/scene-model.ts';
import { worldTransform } from '../render/view-transform.ts';
import { seatColor } from '../seat-colors.ts';
import { useSettingsStore } from '../settings-store.ts';
import { useGalaxyStore, type Viewport } from '../store.ts';
import type { Size } from '../system/use-element-size.ts';
import './map-pings.css';

interface Props {
  readonly hexes: readonly SceneHex[];
  readonly bounds: Bounds;
  readonly viewport: Viewport;
  readonly view: BoardView;
  readonly size: Size;
}

interface Mark {
  readonly ping: MapPing;
  readonly style: CSSProperties;
}

function marks(pings: readonly MapPing[], { hexes, bounds, viewport, view, size }: Props): Mark[] {
  const camera = worldTransform(bounds, size, viewport);
  return pings.flatMap((ping) => {
    const hex = hexes.find((candidate) => candidate.systemId === ping.system);
    if (hex === undefined) return [];
    const at = project(view, hexToPixel(hex.position));
    return [
      {
        ping,
        style: {
          left: camera.x + at.x * camera.scale,
          top: camera.y + at.y * camera.scale,
          color: seatColor(ping.seat + 1),
        },
      },
    ];
  });
}

function PingMark({ ping, style }: Mark): ReactElement {
  const language = useGalaxyStore((state) => state.language);
  const verb = language === 'de' ? 'zeigt auf' : 'points to';
  return (
    <div className="map-ping" style={style} data-system-ping={ping.system}>
      <i className="map-ping-ring" aria-hidden="true" />
      <svg className="map-ping-finger" viewBox="0 0 24 32" aria-hidden="true">
        <path d="M8 16V4a2 2 0 0 1 4 0v8l2-1 3 1 3 1 1 9-4 8H8l-5-9a2 2 0 0 1 3-3l2 3z" />
      </svg>
      <span className="map-ping-label">
        <strong>{ping.name}</strong>
        <small>
          {verb} {ping.system}
        </small>
      </span>
    </div>
  );
}

/** Zeigegesten schweben über dem Brett und folgen exakt derselben Kamera wie die Systeme. */
export function MapPings(props: Props): ReactElement | null {
  const pings = useMapPingStore((state) => state.pings);
  const animations = useSettingsStore((state) => state.animations);
  if (pings.length === 0 || props.size.width <= 0) return null;
  return (
    <div className="map-pings" data-animated={animations} role="status" aria-live="polite">
      {marks(pings, props).map((mark) => (
        <PingMark key={mark.ping.id} {...mark} />
      ))}
    </div>
  );
}
