import { currentActor, type GameState, type PlayerId } from '@stellar/domain';
import { memo, useMemo, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { Hand, RotateCcw } from 'lucide-react';
import { unitArtwork } from '../../artwork/units.ts';
import { useGameStore } from '../../game-store.ts';
import { toSvgPoints, type Point } from '../../hex-geometry.ts';
import { seatColor } from '../../seat-colors.ts';
import {
  fleetPoint,
  movableFleets,
  systemOutline,
  type FleetOrigin,
  type FleetProjection,
} from '../../system/fleet-placement.ts';
import {
  movementScope,
  toggleFleet,
  useMovementDraft,
  useMovementOrders,
} from '../../system/movement-draft.ts';
import { useT } from '../../use-translation.ts';
import { useFleetDrag } from './use-fleet-drag.ts';
import './fleet-pieces.css';

type DragApi = ReturnType<typeof useFleetDrag>;
const keep = (event: { stopPropagation: () => void }) => event.stopPropagation();
const atStyle = (at: Point): CSSProperties => ({ left: at.x, top: at.y });

function FleetMiniatures({
  origin,
  seat,
}: {
  readonly origin: FleetOrigin;
  readonly seat: number;
}) {
  const types = [...new Set(origin.options.map(({ ship }) => ship.type))].slice(0, 3);
  return (
    <span className="fleet-miniatures" aria-hidden="true">
      {types.map((type) => (
        <img key={type} src={unitArtwork(type, seat) ?? undefined} alt="" draggable={false} />
      ))}
      <b>{origin.options.length}</b>
    </span>
  );
}

interface HandleProps {
  readonly origin: FleetOrigin;
  readonly seat: number;
  readonly point: Point;
  readonly chosen: boolean;
  readonly scope: string;
  readonly api: DragApi;
}

function useHandle({ api, origin, scope }: HandleProps) {
  const down = (event: PointerEvent<HTMLElement>) => {
    keep(event);
    if (event.button === 0) event.preventDefault();
    api.drag.start(event, origin);
  };
  return {
    onPointerDown: down,
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      keep(event);
      api.drag.move(event);
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      keep(event);
      api.drag.release(event);
    },
    onPointerCancel: (event: PointerEvent<HTMLElement>) => {
      keep(event);
      api.drag.cancel(event.pointerId);
    },
    onClick: (event: MouseEvent) => {
      keep(event);
      if (event.detail > 0 && api.drag.consumeClick()) return;
      toggleFleet(scope, origin.options);
    },
  };
}

function FleetHandle(props: HandleProps) {
  const t = useT();
  const label = t('fleetPickup').replace('{system}', props.origin.from.toUpperCase());
  return (
    <button
      type="button"
      className="fleet-pickup"
      style={atStyle(props.point)}
      aria-label={label}
      title={label}
      aria-pressed={props.chosen}
      data-origin={props.origin.from}
      {...useHandle(props)}
      onDoubleClick={keep}
      onContextMenu={(event) => event.preventDefault()}
    >
      <FleetMiniatures origin={props.origin} seat={props.seat} />
      <Hand className="fleet-lift-icon" size={12} aria-hidden="true" />
    </button>
  );
}

function DropRegion({
  frame,
  system,
  shown,
}: {
  readonly frame: FleetProjection;
  readonly system: string;
  readonly shown: boolean;
}) {
  const t = useT();
  const point = fleetPoint(frame, system);
  if (!shown || point === null) return null;
  return (
    <>
      <svg
        className="fleet-drop-region"
        width={frame.size.width}
        height={frame.size.height}
        aria-hidden="true"
      >
        <polygon points={toSvgPoints(systemOutline(frame, system))} />
      </svg>
      <span className="fleet-drop-label" style={atStyle(point)}>
        {t('fleetDropHere')}
      </span>
    </>
  );
}

function FloatingFleet({ api, seat }: { readonly api: DragApi; readonly seat: number }) {
  if (api.lifted === null) return null;
  const { origin, at } = api.lifted;
  return (
    <div
      ref={api.ghost}
      className="fleet-ghost"
      data-valid="false"
      style={{ transform: `translate(${String(at.x)}px, ${String(at.y)}px)` }}
      aria-hidden="true"
    >
      <FleetMiniatures origin={origin} seat={seat} />
    </div>
  );
}

interface StagedProps {
  readonly origins: readonly FleetOrigin[];
  readonly frame: FleetProjection;
  readonly scope: string;
  readonly active: string;
  readonly seat: number;
  readonly game: GameState;
}

function ResetFleet({ scope }: { readonly scope: string }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={t('fleetReset')}
      title={t('fleetReset')}
      onPointerDown={keep}
      onClick={(event) => {
        keep(event);
        useMovementDraft.getState().change(scope, () => ({}));
      }}
    >
      <RotateCcw size={12} aria-hidden="true" />
    </button>
  );
}

function StagedFleet({ origins, frame, scope, active, seat, game }: StagedProps) {
  const t = useT();
  const { orders } = useMovementOrders(game);
  const options = origins
    .flatMap((origin) => origin.options)
    .filter(({ ship }) => orders[ship.id] !== undefined);
  const point = fleetPoint(frame, active);
  if (options.length === 0 || point === null) return null;
  return (
    <div className="fleet-staged" style={atStyle(point)}>
      <FleetMiniatures origin={{ from: active, options }} seat={seat} />
      <small>{t('fleetPreview')}</small>
      <ResetFleet scope={scope} />
    </div>
  );
}

interface MovementProps {
  readonly game: GameState;
  readonly me: PlayerId;
  readonly frame: FleetProjection;
}

function FleetHandles({ game, me, frame }: MovementProps) {
  const origins = useMemo(() => movableFleets(game, me), [game, me]);
  const active = game.actionPhase?.tactical?.system ?? '';
  const scope = movementScope(game);
  const api = useFleetDrag({ frame, active, scope });
  const { orders } = useMovementOrders(game);
  const seat = (game.players.find((player) => player.id === me)?.seat ?? 0) + 1;
  if (origins.length === 0) return null;
  return (
    <div className="fleet-interaction" style={{ '--fleet-seat': seatColor(seat) } as CSSProperties}>
      <DropRegion frame={frame} system={active} shown={api.lifted !== null} />
      {origins.map((origin) => {
        const point = fleetPoint(frame, origin.from);
        const chosen = origin.options.every(({ ship }) => orders[ship.id] !== undefined);
        return point === null ? null : (
          <FleetHandle key={origin.from} {...{ origin, seat, point, chosen, scope, api }} />
        );
      })}
      <StagedFleet {...{ origins, frame, scope, active, seat, game }} />
      <FloatingFleet api={api} seat={seat} />
    </div>
  );
}

/** A lifted fleet stages real legal move options. The existing form confirms all ships and cargo. */
export const FleetPieces = memo(function FleetPieces(frame: FleetProjection) {
  const game = useGameStore((state) => state.game);
  const me = useGameStore((state) => state.me);
  if (game === null || me === null || currentActor(game) !== me) return null;
  return <FleetHandles {...{ game, me, frame }} />;
});
