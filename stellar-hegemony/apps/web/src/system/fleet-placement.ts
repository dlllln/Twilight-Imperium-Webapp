import { currentActor, type GameState, type MovementOption, type PlayerId } from '@stellar/domain';
import { type Bounds, hexToPixel, type Point } from '../hex-geometry.ts';
import { interrupted } from '../hand/hand-model.ts';
import { type BoardView, lift, plus, projectedCorners, turn } from '../render/board-view.ts';
import { SHIP_HEIGHT, shipSlots } from '../render/hex-layout.ts';
import type { SceneHex } from '../render/scene-model.ts';
import { worldTransform } from '../render/view-transform.ts';
import { content, type Viewport } from '../store.ts';
import { movementChoices } from '../tactical-view.ts';
import type { Size } from './use-element-size.ts';

export interface FleetProjection {
  readonly hexes: readonly SceneHex[];
  readonly bounds: Bounds;
  readonly viewport: Viewport;
  readonly view: BoardView;
  readonly size: Size;
}

export interface FleetOrigin {
  readonly from: string;
  readonly options: readonly MovementOption[];
}

export function movableFleets(game: GameState, me: PlayerId | null): readonly FleetOrigin[] {
  if (me === null || currentActor(game) !== me || interrupted(game, me)) return [];
  const grouped = new Map<string, MovementOption[]>();
  for (const option of movementChoices(game, content)) {
    const group = grouped.get(option.from) ?? [];
    group.push(option);
    grouped.set(option.from, group);
  }
  return [...grouped].map(([from, options]) => ({ from, options }));
}

export function boardPoint(frame: FleetProjection, at: Point): Point {
  const camera = worldTransform(frame.bounds, frame.size, frame.viewport);
  return { x: camera.x + at.x * camera.scale, y: camera.y + at.y * camera.scale };
}

/** A handle sits over the fleet miniatures, leaving the rest of the hex available for panning. */
export function fleetPoint(frame: FleetProjection, system: string): Point | null {
  const hex = frame.hexes.find((candidate) => candidate.systemId === system);
  if (hex === undefined) return null;
  const center = turn(frame.view, hexToPixel(hex.position));
  const slots = shipSlots(hex.ships.length);
  const front = slots[0] ?? { x: 0, y: 33 };
  return boardPoint(frame, lift(plus(center, front), SHIP_HEIGHT, frame.view.tilt));
}

const cross = (a: Point, b: Point, at: Point): number =>
  (b.x - a.x) * (at.y - a.y) - (b.y - a.y) * (at.x - a.x);

/** Convex projected hex, including its edges; works at every zoom and board rotation. */
export function insideSystem(frame: FleetProjection, system: string, at: Point): boolean {
  const corners = systemOutline(frame, system);
  if (corners.length === 0) return false;
  const sides = corners.map((a, index) => cross(a, corners[(index + 1) % corners.length] ?? a, at));
  return sides.every((value) => value >= -0.01) || sides.every((value) => value <= 0.01);
}

export function systemOutline(frame: FleetProjection, system: string): readonly Point[] {
  const hex = frame.hexes.find((candidate) => candidate.systemId === system);
  return hex === undefined
    ? []
    : projectedCorners(frame.view, hexToPixel(hex.position)).map((p) => boardPoint(frame, p));
}
