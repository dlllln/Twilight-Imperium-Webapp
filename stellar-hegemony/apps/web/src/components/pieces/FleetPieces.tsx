import {
  currentActor,
  type GameState,
  type MovementOption,
  type PlayerId,
  type UnitTypeId,
} from '@stellar/domain';
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { Hand, Minus, PackagePlus, RotateCcw } from 'lucide-react';
import { unitArtwork } from '../../artwork/units.ts';
import { useGameStore } from '../../game-store.ts';
import { toSvgPoints, type Point } from '../../hex-geometry.ts';
import { unitLabel } from '../../labels.ts';
import { seatColor } from '../../seat-colors.ts';
import { content } from '../../store.ts';
import {
  fleetPoint,
  movableFleets,
  systemOutline,
  type FleetOrigin,
  type FleetProjection,
} from '../../system/fleet-placement.ts';
import {
  type MovementOrders,
  movementScope,
  toggleFleet,
  useMovementDraft,
  useMovementOrders,
} from '../../system/movement-draft.ts';
import { autoLoad, moveSummary, unstageOne } from '../../table/move-draft.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { awayFromRoutes, MovePaths } from './MovePaths.tsx';
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
  readonly me: PlayerId;
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

/** Schreibt eine Änderung in den gemeinsamen Entwurf, ohne dass die Karte schwenkt. */
const changeDraft =
  (scope: string, update: (orders: MovementOrders) => MovementOrders) => (event: MouseEvent) => {
    keep(event);
    useMovementDraft.getState().change(scope, update);
  };

/** Nur die Schiffe, die gerade zulässig vorgemerkt sind, samt ihrer Fracht. */
const stagedOrders = (options: readonly MovementOption[], orders: MovementOrders) =>
  Object.fromEntries(options.map(({ ship }) => [ship.id, orders[ship.id] ?? []]));

/** Merkt sich Ziele für den Fokus; nach dem nächsten Zeichnen bekommt ihn das erste vorhandene. */
type Refocus = (selectors: readonly string[]) => void;

function useRefocus(): Refocus {
  const pending = useRef<readonly string[] | null>(null);
  useEffect(() => {
    const selectors = pending.current;
    pending.current = null;
    const next = selectors
      ?.map((selector) => document.querySelector<HTMLElement>(selector))
      .find((element) => element !== null);
    next?.focus();
  });
  return (selectors) => {
    pending.current = selectors;
  };
}

interface StagedPart {
  readonly all: readonly MovementOption[];
  readonly staged: readonly MovementOption[];
  readonly scope: string;
  readonly seat: number;
  readonly refocus: Refocus;
}

/**
 * Nach dem Zurücknehmen bleibt der Fokus in der Vorschau: derselbe Knopf, sonst ein anderer
 * Schiffstyp, sonst der Griff der Flotte, aus der das Schiff kam. Nie im Leeren.
 */
function unstageFocus(option: MovementOption | undefined, type: UnitTypeId): readonly string[] {
  return [
    `.fleet-staged [data-staged-control="unstage:${type}"]`,
    '.fleet-staged .fleet-unstage',
    `.fleet-pickup[data-origin="${option?.from ?? ''}"]`,
  ];
}

function UnstageButton({
  all,
  staged,
  scope,
  seat,
  refocus,
  type,
}: StagedPart & { type: UnitTypeId }) {
  const t = useT();
  const label = t('fleetUnstage').replace('{unit}', unitLabel(type, useLanguage()));
  const change = changeDraft(scope, (orders) => unstageOne(all, orders, type));
  const from = staged.find(({ ship }) => ship.type === type);
  return (
    <button
      type="button"
      className="fleet-unstage"
      aria-label={label}
      title={label}
      data-staged-control={`unstage:${type}`}
      onPointerDown={keep}
      onClick={(event) => {
        if (event.currentTarget === document.activeElement) refocus(unstageFocus(from, type));
        change(event);
      }}
    >
      <img src={unitArtwork(type, seat) ?? undefined} alt="" draggable={false} />
      <Minus size={10} aria-hidden="true" />
    </button>
  );
}

function UnstageShips(part: StagedPart) {
  const types = [...new Set(part.staged.map(({ ship }) => ship.type))];
  return types.map((type) => <UnstageButton key={type} {...part} type={type} />);
}

interface LoadProps {
  readonly game: GameState;
  readonly me: PlayerId;
  readonly all: readonly MovementOption[];
  readonly orders: MovementOrders;
  readonly scope: string;
}

/** Fracht, die „Fracht laden“ insgesamt an Bord brächte, und was davon noch fehlt. */
function useCargoGain({ game, me, all, orders }: LoadProps) {
  return useMemo(() => {
    const full = moveSummary(autoLoad(game, content, all, orders, me)).cargo;
    return { full, gain: full - moveSummary(orders).cargo };
  }, [game, all, orders, me]);
}

/**
 * Erscheint, sobald die vorgemerkten Träger überhaupt Fracht aufnehmen können. Ist alles an Bord,
 * bleibt der Knopf stehen und meldet sich als gesperrt, damit der Fokus nicht ins Leere fällt.
 */
function CargoLoad(props: LoadProps) {
  const t = useT();
  const { full, gain } = useCargoGain(props);
  const { game, me, all, scope } = props;
  if (full <= 0) return null;
  const load = changeDraft(scope, (current) => autoLoad(game, content, all, current, me));
  return (
    <button
      type="button"
      className="fleet-cargo-load"
      title={t('cargoAutoLoad')}
      aria-disabled={gain <= 0}
      data-staged-control="cargo"
      onPointerDown={keep}
      onClick={(event) => {
        if (gain > 0) load(event);
        else keep(event);
      }}
    >
      <PackagePlus size={12} aria-hidden="true" />
      {t('cargoAutoLoad')}
    </button>
  );
}

/** Abstand der Vorschau vom aktivierten System, weg von den hereinkommenden Wegen (Pixel). */
const AWAY_PX = 30;

/** Lage der Vorschau: neben dem System auf der Seite, von der kein Weg hereinkommt. */
function stagedStyle(point: Point, away: Point | null): CSSProperties {
  if (away === null) return atStyle(point);
  const at = { x: point.x + away.x * AWAY_PX, y: point.y + away.y * AWAY_PX };
  return { ...atStyle(at), '--away-x': away.x, '--away-y': away.y } as CSSProperties;
}

function StagedSummary({
  staged,
  orders,
}: {
  readonly staged: readonly MovementOption[];
  readonly orders: MovementOrders;
}) {
  const t = useT();
  const { ships, cargo } = moveSummary(stagedOrders(staged, orders));
  const summary = t('moveSummary')
    .replace('{ships}', String(ships))
    .replace('{cargo}', String(cargo));
  return (
    <span
      className="fleet-staged-count"
      data-testid="staged-summary"
      aria-live="polite"
      aria-atomic="true"
    >
      {summary}
    </span>
  );
}

function StagedFleet({ origins, frame, scope, active, seat, game, me }: StagedProps) {
  const t = useT();
  const { orders } = useMovementOrders(game);
  const refocus = useRefocus();
  const all = useMemo(() => origins.flatMap((origin) => origin.options), [origins]);
  const staged = all.filter(({ ship }) => orders[ship.id] !== undefined);
  const point = fleetPoint(frame, active);
  if (staged.length === 0 || point === null) return null;
  const away = awayFromRoutes(frame, staged, active);
  return (
    <div
      className="fleet-staged"
      style={stagedStyle(point, away)}
      data-away={away === null ? undefined : 'true'}
    >
      <FleetMiniatures origin={{ from: active, options: staged }} seat={seat} />
      <small>{t('fleetPreview')}</small>
      <StagedSummary staged={staged} orders={orders} />
      <UnstageShips {...{ all, staged, scope, seat, refocus }} />
      <CargoLoad {...{ game, me, all, orders, scope }} />
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
      <MovePaths
        frame={frame}
        options={origins.flatMap(({ options }) => options)}
        orders={orders}
      />
      <DropRegion frame={frame} system={active} shown={api.lifted !== null} />
      {origins.map((origin) => {
        const point = fleetPoint(frame, origin.from);
        const chosen = origin.options.every(({ ship }) => orders[ship.id] !== undefined);
        return point === null ? null : (
          <FleetHandle key={origin.from} {...{ origin, seat, point, chosen, scope, api }} />
        );
      })}
      <StagedFleet {...{ origins, frame, scope, active, seat, game, me }} />
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
