import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { unitArtwork } from '../../artwork/units.ts';
import { useGameStore } from '../../game-store.ts';
import type { Point } from '../../hex-geometry.ts';
import { seatColor } from '../../seat-colors.ts';
import type { FleetProjection } from '../../system/fleet-placement.ts';
import { FactionEmblem } from '../simulator/FactionEmblem.tsx';
import { mapPiecePath, type MapPieceMove } from './map-motion-events.ts';
import { useMapPieceMotion } from './use-map-piece-motion.ts';
import './tabletop-map-motion.css';

function visibleCenter(node: Element | undefined | null, host: DOMRect): Point | null {
  if (node === null || node === undefined) return null;
  const box = node.getBoundingClientRect();
  return box.width <= 0 || box.height <= 0
    ? null
    : { x: box.left + box.width / 2 - host.left, y: box.top + box.height / 2 - host.top };
}

function tokenOrigin(move: MapPieceMove, host: DOMRect, frame: FleetProjection): Point {
  const me = useGameStore.getState().me;
  const tray =
    move.player === me ? document.querySelector('.sheet-tray[data-pool="tactic"]') : null;
  const portrait = [...document.querySelectorAll('.hud-portrait button')].find(
    (button) => button.getAttribute('aria-label') === move.name,
  );
  return (
    visibleCenter(tray, host) ??
    visibleCenter(portrait, host) ?? {
      x: move.player === me ? frame.size.width / 2 : 32 + move.seat * 32,
      y: move.player === me ? frame.size.height - 15 : 24,
    }
  );
}

function animationFrames(points: readonly Point[], token: boolean): Keyframe[] {
  const frames = points.map((point, index) => ({
    transform: `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) scale(${index === points.length - 1 ? 0.68 : 1.08})`,
    opacity: 1,
    offset: (index / Math.max(1, points.length - 1)) * 0.86,
    filter: `drop-shadow(2px ${token ? 8 : 12}px 4px #0009)`,
  }));
  return [...frames, { ...frames.at(-1), opacity: 0, offset: 1 }];
}

function playPiece(
  node: HTMLElement,
  points: readonly Point[],
  token: boolean,
  order: number,
): () => void {
  if (typeof node.animate !== 'function' || points.length < 2) return () => undefined;
  const animation = node.animate(animationFrames(points, token), {
    duration: token ? 850 : Math.min(1200, 500 + points.length * 130),
    delay: Math.min(order * 18, 180),
    easing: 'cubic-bezier(.2,.7,.3,1)',
    fill: 'both',
  });
  return () => animation.cancel();
}

interface MovingProps {
  readonly move: MapPieceMove;
  readonly frame: FleetProjection;
  readonly host: RefObject<HTMLDivElement>;
  readonly order: number;
}

function useMovingPiece({ move, frame, host, order }: MovingProps) {
  const piece = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (piece.current === null || host.current === null) return;
    const path = mapPiecePath(frame, move);
    if (path.length === 0) return;
    const points =
      move.kind === 'token'
        ? [tokenOrigin(move, host.current.getBoundingClientRect(), frame), ...path]
        : path;
    return playPiece(piece.current, points, move.kind === 'token', order);
  }, [move, frame, host, order]);
  return piece;
}

function MovingPiece(props: MovingProps) {
  const piece = useMovingPiece(props);
  const { move } = props;
  const artwork = move.kind === 'ship' ? unitArtwork(move.type, move.seat) : null;
  return (
    <span
      ref={piece}
      className="tabletop-map-piece"
      data-material={move.kind}
      style={{ '--material-seat': seatColor(move.seat) } as CSSProperties}
    >
      {move.kind === 'token' ? (
        <FactionEmblem id={move.faction} size={23} />
      ) : (
        artwork !== null && <img src={artwork} alt="" draggable={false} />
      )}
    </span>
  );
}

/** Finite material moves decorate real events; the underlying board remains fully clickable. */
export function TabletopMapMotion(frame: FleetProjection) {
  const host = useRef<HTMLDivElement>(null);
  const activity = useMapPieceMotion(frame);
  return (
    <div ref={host} className="tabletop-map-motion" aria-hidden="true">
      {activity?.moves.map((move, order) => (
        <MovingPiece
          key={`${activity.serial}-${order}`}
          move={move}
          frame={activity.frame}
          host={host}
          order={order}
        />
      ))}
    </div>
  );
}
