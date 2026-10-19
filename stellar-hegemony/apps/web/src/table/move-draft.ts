import {
  type ContentPort,
  type GameState,
  type MovementOption,
  type PlayerId,
  technologyCatalog,
  type UnitId,
  unitId,
  type UnitTypeId,
} from '@stellar/domain';
import type { MovementOrders } from '../system/movement-draft.ts';
import { cargoAtOrigin } from '../tactical-view.ts';

/*
 * Rechnen über dem Bewegungsentwurf (reine Funktionen über `MovementOrders`): Schlüssel ist das
 * vorgemerkte Schiff, Wert seine Fracht. Messleiste, automatisches Beladen und das Zurücknehmen
 * eines einzelnen Schiffs einer Art.
 */

export interface MoveSummary {
  readonly ships: number;
  readonly cargo: number;
}

/** Vorgemerkte Schiffe und ihre Fracht für die Messleiste „Schiffe · Fracht“. */
export function moveSummary(orders: MovementOrders): MoveSummary {
  const loads = Object.values(orders);
  return { ships: loads.length, cargo: loads.reduce((sum, cargo) => sum + cargo.length, 0) };
}

/** Was beim Beladen feststeht: Spielstand, Stammdaten und Spieler. */
interface Loader {
  readonly game: GameState;
  readonly content: ContentPort;
  readonly player: PlayerId;
}

/** Füllt ein Schiff bis zur Kapazität mit Fracht aus seinem Herkunftssystem; `taken` wächst mit. */
function loadShip(
  loader: Loader,
  option: MovementOption,
  cargo: readonly UnitId[],
  taken: Set<UnitId>,
) {
  const { game, content, player } = loader;
  const capacity = technologyCatalog(game, content).find(option.ship.type, player)?.capacity ?? 0;
  const free = cargoAtOrigin(game, content, option, player).filter((unit) => !taken.has(unit.id));
  const added = free.slice(0, Math.max(0, capacity - cargo.length)).map((unit) => unit.id);
  for (const id of added) taken.add(id);
  return [...cargo, ...added];
}

/** Bereits Verplantes: vorgemerkte Schiffe und jede schon geladene Einheit. */
const takenOf = (orders: MovementOrders): Set<UnitId> =>
  new Set(Object.entries(orders).flatMap(([ship, cargo]) => [unitId(ship), ...cargo]));

/**
 * „Fracht laden“: Jedes vorgemerkte Schiff nimmt aus seinem Herkunftssystem auf, was noch Platz
 * hat. Vorhandene Fracht bleibt, keine Einheit wird zweimal geladen.
 */
export function autoLoad(
  game: GameState,
  content: ContentPort,
  options: readonly MovementOption[],
  orders: MovementOrders,
  player: PlayerId,
): MovementOrders {
  const taken = takenOf(orders);
  const next: Record<string, readonly UnitId[]> = { ...orders };
  for (const option of options) {
    const cargo = orders[option.ship.id];
    if (cargo !== undefined)
      next[option.ship.id] = loadShip({ game, content, player }, option, cargo, taken);
  }
  return next;
}

/** Nimmt das zuletzt vorgemerkte Schiff einer Art zurück (Reihenfolge des Vormerkens), samt Fracht. */
export function unstageOne(
  options: readonly MovementOption[],
  orders: MovementOrders,
  type: UnitTypeId,
): MovementOrders {
  const ofType = new Set(
    options.filter(({ ship }) => ship.type === type).map(({ ship }) => ship.id),
  );
  const last = Object.keys(orders)
    .filter((ship) => ofType.has(unitId(ship)))
    .at(-1);
  if (last === undefined) return orders;
  return Object.fromEntries(Object.entries(orders).filter(([ship]) => ship !== last));
}
