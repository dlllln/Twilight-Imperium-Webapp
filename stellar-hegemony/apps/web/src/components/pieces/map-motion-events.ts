import type {
  GameEvent,
  GameState,
  PlayerId,
  ShipMovement,
  ShipsMoved,
  Unit,
} from '@stellar/domain';
import { hexToPixel, type Point } from '../../hex-geometry.ts';
import { lift, plus, turn } from '../../render/board-view.ts';
import { TOKEN_Y } from '../../render/hex-layout.ts';
import { boardPoint, fleetPoint, type FleetProjection } from '../../system/fleet-placement.ts';

interface Owner {
  readonly player: PlayerId;
  readonly name: string;
  readonly faction: string;
  readonly seat: number;
}
export type MapPieceMove = Owner &
  (
    | { readonly kind: 'token'; readonly system: string }
    | {
        readonly kind: 'ship';
        readonly unit: string;
        readonly type: string;
        readonly path: readonly string[];
      }
  );
export const MAX_MAP_PIECES = 24;

function travellingShip(owner: Owner, unit: Unit, movement: ShipMovement): MapPieceMove {
  return {
    ...owner,
    kind: 'ship',
    unit: unit.id,
    type: unit.type,
    path: [movement.from, ...movement.path],
  };
}

function shipMove(
  before: GameState,
  event: ShipsMoved,
  movement: ShipMovement,
  owner: Owner,
): MapPieceMove[] {
  const unit = before.systems[movement.from]?.spaceUnits.find((ship) => ship.id === movement.ship);
  if (unit === undefined || unit.owner !== event.player || movement.path.length === 0) return [];
  if (
    movement.path.at(-1) !== event.system ||
    movement.path.some((id) => before.systems[id] === undefined)
  )
    return [];
  return [travellingShip(owner, unit, movement)];
}

function eventMoves(before: GameState, event: GameEvent): readonly MapPieceMove[] {
  if (event.type !== 'SystemActivated' && event.type !== 'ShipsMoved') return [];
  const player = before.players.find((entry) => entry.id === event.player);
  if (player === undefined || before.systems[event.system] === undefined) return [];
  const owner: Owner = {
    player: player.id,
    name: player.name,
    faction: player.faction,
    seat: player.seat + 1,
  };
  if (event.type === 'SystemActivated') return [{ ...owner, kind: 'token', system: event.system }];
  return event.movements.flatMap((movement) => shipMove(before, event, movement, owner));
}

/** Public board material only: no hand, secret objective or cargo identities leave this extractor. */
export function mapPieceMoves(
  before: GameState,
  events: readonly GameEvent[],
): readonly MapPieceMove[] {
  return events.flatMap((event) => eventMoves(before, event)).slice(0, MAX_MAP_PIECES);
}

function tokenPoint(frame: FleetProjection, system: string): Point | null {
  const hex = frame.hexes.find((entry) => entry.systemId === system);
  if (hex === undefined) return null;
  const center = turn(frame.view, hexToPixel(hex.position));
  return boardPoint(frame, lift(plus(center, { x: 0, y: TOKEN_Y }), 0, frame.view.tilt));
}

/** Same board/camera mapping as the rendered tokens and fleet handles. Unknown paths stay hidden. */
export function mapPiecePath(frame: FleetProjection, move: MapPieceMove): readonly Point[] {
  const points =
    move.kind === 'token'
      ? [tokenPoint(frame, move.system)]
      : move.path.map((system) => fleetPoint(frame, system));
  return points.some((point) => point === null) ? [] : points.filter((point) => point !== null);
}

export function mapMotionFrameKey(frame: FleetProjection): string {
  return JSON.stringify([
    frame.bounds,
    frame.viewport,
    frame.view,
    frame.size,
    frame.hexes.map((hex) => [hex.systemId, hex.position.q, hex.position.r]),
  ]);
}
