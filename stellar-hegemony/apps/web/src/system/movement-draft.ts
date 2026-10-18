import type { GameState, MovementOption, ShipMoveOrder, UnitId } from '@stellar/domain';
import { create } from 'zustand';

export type MovementOrders = Readonly<Record<string, readonly UnitId[]>>;
const EMPTY: MovementOrders = {};

interface Draft {
  readonly scope: string;
  readonly orders: MovementOrders;
  readonly change: (scope: string, update: (orders: MovementOrders) => MovementOrders) => void;
}

/** A server version change invalidates all staged moves, including their cargo. */
export const movementScope = (game: GameState): string =>
  `${game.id}:${String(game.version)}:${game.actionPhase?.tactical?.system ?? ''}`;

export const useMovementDraft = create<Draft>((set) => ({
  scope: '',
  orders: EMPTY,
  change: (scope, update) =>
    set((state) => ({
      scope,
      orders: update(state.scope === scope ? state.orders : EMPTY),
    })),
}));

const without = (orders: MovementOrders, ship: UnitId): MovementOrders => {
  const { [ship]: removed, ...rest } = orders;
  return removed === undefined ? { ...rest, [ship]: [] } : rest;
};

export function stageShips(scope: string, options: readonly MovementOption[]): void {
  useMovementDraft.getState().change(scope, (orders) => {
    const next = { ...orders };
    for (const { ship } of options) next[ship.id] ??= [];
    return next;
  });
}

export function toggleFleet(scope: string, options: readonly MovementOption[]): void {
  const state = useMovementDraft.getState();
  const orders = state.scope === scope ? state.orders : EMPTY;
  if (!options.every(({ ship }) => orders[ship.id] !== undefined)) {
    stageShips(scope, options);
    return;
  }
  state.change(scope, (current) =>
    Object.fromEntries(
      Object.entries(current).filter(([id]) => !options.some(({ ship }) => ship.id === id)),
    ),
  );
}

function changeCargo(orders: MovementOrders, ship: UnitId, unit: UnitId): MovementOrders {
  const cargo = orders[ship];
  if (cargo === undefined) return orders;
  if (Object.entries(orders).some(([other, load]) => other !== ship && load.includes(unit)))
    return orders;
  const next = cargo.includes(unit) ? cargo.filter((id) => id !== unit) : [...cargo, unit];
  return { ...orders, [ship]: next };
}

/** Both the physical fleet handles and the accessible checklist edit this draft. */
export function useMovementOrders(game: GameState) {
  const scope = movementScope(game);
  const orders = useMovementDraft((state) => (state.scope === scope ? state.orders : EMPTY));
  const change = useMovementDraft((state) => state.change);
  return {
    orders,
    toggleShip: (ship: UnitId) => change(scope, (current) => without(current, ship)),
    toggleCargo: (ship: UnitId, unit: UnitId) =>
      change(scope, (current) => changeCargo(current, ship, unit)),
    loadedElsewhere: (ship: UnitId, unit: UnitId) =>
      Object.entries(orders).some(([other, cargo]) => other !== ship && cargo.includes(unit)),
  };
}

export const moveOrders = (
  options: readonly MovementOption[],
  orders: MovementOrders,
): ShipMoveOrder[] =>
  options.flatMap(({ ship, path }) => {
    const cargo = orders[ship.id];
    return cargo === undefined ? [] : [{ ship: ship.id, path, cargo }];
  });
