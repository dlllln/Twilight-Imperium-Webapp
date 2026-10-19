import type { MovementOption } from '@stellar/domain';
import { useReducedMotion } from 'motion/react';
import { useId } from 'react';
import type { Point } from '../../hex-geometry.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { fleetPoint, type FleetProjection } from '../../system/fleet-placement.ts';
import type { MovementOrders } from '../../system/movement-draft.ts';

/** Ein Weg vom Herkunftssystem über alle Zwischenhalte bis ins aktivierte System. */
interface StagedRoute {
  readonly from: string;
  readonly systems: readonly string[];
  readonly count: number;
}

/** Gleiche Wege fassen ihre vorgemerkten Schiffe zusammen; Reihenfolge wie beim Vormerken. */
function stagedRoutes(
  options: readonly MovementOption[],
  orders: MovementOrders,
): readonly StagedRoute[] {
  const routes = new Map<string, StagedRoute>();
  for (const option of options) {
    if (orders[option.ship.id] === undefined) continue;
    const systems: string[] = [option.from, ...option.path];
    const key = systems.join('>');
    const count = (routes.get(key)?.count ?? 0) + 1;
    routes.set(key, { from: option.from, systems, count });
  }
  return [...routes.values()];
}

/** Bildschirmpunkte eines Wegs; fehlt ein System auf dem Brett, entfällt der ganze Weg. */
function routePoints(frame: FleetProjection, route: StagedRoute): string | null {
  const points = route.systems.map((system) => fleetPoint(frame, system));
  if (points.some((point) => point === null)) return null;
  return points
    .filter((point): point is Point => point !== null)
    .map(({ x, y }) => `${String(x)},${String(y)}`)
    .join(' ');
}

/** Das letzte System vor dem Ziel: Von dort kommt der Weg ins aktivierte System herein. */
const lastStop = (option: MovementOption, active: string): string =>
  [option.from, ...option.path].filter((system) => system !== active).at(-1) ?? option.from;

/**
 * Richtung (Einheitsvektor) vom aktivierten System weg von den hereinkommenden Wegen: Dorthin
 * rückt die Vorschau, damit sie die Enden der Wege nicht verdeckt. `null` ohne Wege.
 */
export function awayFromRoutes(
  frame: FleetProjection,
  staged: readonly MovementOption[],
  active: string,
): Point | null {
  const target = fleetPoint(frame, active);
  const stops = staged.map((option) => fleetPoint(frame, lastStop(option, active)));
  const known = stops.filter((point): point is Point => point !== null);
  if (target === null || known.length === 0) return null;
  const x = target.x - known.reduce((sum, point) => sum + point.x, 0) / known.length;
  const y = target.y - known.reduce((sum, point) => sum + point.y, 0) / known.length;
  const length = Math.hypot(x, y);
  return length < 1 ? null : { x: x / length, y: y / length };
}

interface MovePathsProps {
  readonly frame: FleetProjection;
  readonly options: readonly MovementOption[];
  readonly orders: MovementOrders;
}

/** Pfeilspitze am Ende jedes Wegs: Dort, im aktivierten System, kommen die Schiffe an. */
function ArrowHead({ id }: { readonly id: string }) {
  return (
    <defs>
      <marker
        id={id}
        className="move-path-head"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="4"
        markerHeight="4"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L10,5 L0,10 z" />
      </marker>
    </defs>
  );
}

interface RouteProps {
  readonly frame: FleetProjection;
  readonly route: StagedRoute;
  readonly head: string;
}

function RoutePath({ frame, route, head }: RouteProps) {
  const points = routePoints(frame, route);
  return points === null ? null : (
    <polyline
      className="move-path"
      points={points}
      markerEnd={`url(#${head})`}
      data-from={route.from}
      data-count={route.count}
    />
  );
}

/** Gestrichelte Wege der vorgemerkten Schiffe; die Striche wandern nur bei erlaubter Bewegung. */
export function MovePaths({ frame, options, orders }: MovePathsProps) {
  const animations = useSettingsStore((state) => state.animations);
  const reduced = useReducedMotion() === true;
  const head = `move-path-head${useId().replace(/:/g, '')}`;
  const routes = stagedRoutes(options, orders);
  if (routes.length === 0) return null;
  return (
    <svg
      className="move-paths"
      width={frame.size.width}
      height={frame.size.height}
      aria-hidden="true"
      data-motion={animations && !reduced}
    >
      <ArrowHead id={head} />
      {routes.map((route) => (
        <RoutePath key={route.systems.join('>')} frame={frame} route={route} head={head} />
      ))}
    </svg>
  );
}
