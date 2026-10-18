import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { useSettingsStore } from '../../settings-store.ts';
import type { FleetProjection } from '../../system/fleet-placement.ts';
import { mapMotionFrameKey, mapPieceMoves, type MapPieceMove } from './map-motion-events.ts';

export const MAP_MOTION_MS = 1500;
interface MapActivity {
  readonly serial: number;
  readonly frame: FleetProjection;
  readonly moves: readonly MapPieceMove[];
}

function useActivityExpiry(activity: MapActivity | null, expire: (value: null) => void): void {
  useEffect(() => {
    if (activity === null) return;
    const timer = window.setTimeout(() => expire(null), MAP_MOTION_MS);
    return () => window.clearTimeout(timer);
  }, [activity, expire]);
}

/** Snapshot/reconnect data is acknowledged on mount; only genuinely new received events animate. */
export function useMapPieceMotion(frame: FleetProjection): MapActivity | null {
  const last = useGameStore((state) => state.lastEvents);
  const animations = useSettingsStore((state) => state.animations);
  const reduced = useReducedMotion();
  const enabled = animations && !reduced;
  const seen = useRef(last?.serial ?? 0);
  const [activity, setActivity] = useState<MapActivity | null>(null);
  const camera = mapMotionFrameKey(frame);
  useEffect(() => {
    const latest = last?.serial ?? 0;
    const fresh = latest > seen.current;
    seen.current = latest;
    const moves = last !== null && enabled && fresh ? mapPieceMoves(last.before, last.events) : [];
    setActivity(moves.length === 0 ? null : { serial: latest, frame, moves });
  }, [last, enabled, camera]);
  useActivityExpiry(activity, setActivity);
  return activity;
}
