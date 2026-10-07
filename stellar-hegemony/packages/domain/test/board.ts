import {
  type AnomalyKind,
  type GameState,
  planetId,
  type PlayerId,
  type ShipMoveOrder,
  systemId,
  type SystemState,
  type Unit,
} from '../src/index.ts';
import { RED } from './fixtures.ts';
import { actionPhaseGame } from './game-flow.ts';

export interface Spec {
  readonly id: string;
  readonly q: number;
  readonly anomaly?: AnomalyKind;
  readonly units?: readonly Unit[];
  readonly tokens?: readonly PlayerId[];
  readonly planet?: readonly Unit[];
  readonly planetController?: PlayerId | null;
  /** Eigene Planeten-Id, z. B. um Stammdaten aus den Test-Tafeln zu nutzen. */
  readonly planetId?: string;
}

export const S = (id: string) => systemId(id);
export const planetOf = (spec: Spec) => planetId(spec.planetId ?? `p-${spec.id}`);

const toSystem = (spec: Spec): SystemState => ({
  id: S(spec.id),
  position: { q: spec.q, r: 0 },
  planetIds: spec.planet === undefined ? [] : [planetOf(spec)],
  wormholes: [],
  spaceUnits: spec.units ?? [],
  commandTokens: spec.tokens ?? [],
  ...(spec.anomaly === undefined ? {} : { anomaly: spec.anomaly }),
});

const toPlanet = (spec: Spec) => ({
  id: planetOf(spec),
  controller: spec.planetController === undefined ? RED : spec.planetController,
  exhausted: false,
  units: spec.planet ?? [],
});

/** Systeme in einer Reihe (q = 0, 1, 2, …); Rot ist am Zug. */
export function board(...specs: readonly Spec[]): GameState {
  const base = actionPhaseGame();
  const planets = specs
    .filter((spec) => spec.planet !== undefined)
    .map((spec) => [planetOf(spec), toPlanet(spec)] as const);
  return {
    ...base,
    planets: { ...base.planets, ...Object.fromEntries(planets) },
    systems: Object.fromEntries(specs.map((spec) => [spec.id, toSystem(spec)])),
  };
}

export const activate = (system: string, issuedBy = RED) =>
  ({ type: 'ActivateSystem', issuedBy, system: S(system) }) as const;

export const moves = (...orders: readonly ShipMoveOrder[]) =>
  ({ type: 'MoveShips', issuedBy: RED, moves: orders }) as const;

export const order = (
  ship: Unit,
  path: readonly string[],
  cargo: readonly Unit[] = [],
): ShipMoveOrder => ({
  ship: ship.id,
  path: path.map(S),
  cargo: cargo.map((entry) => entry.id),
});
