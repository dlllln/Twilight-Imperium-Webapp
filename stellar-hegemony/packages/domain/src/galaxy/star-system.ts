import { type DomainError } from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import { combine, map, ok, type Result } from '../shared/result.ts';
import type { PlanetState } from '../planet/planet-state.ts';
import {
  countsTowardFleetLimit,
  findCapability,
  isShip,
  occupiesCapacity,
} from '../unit/unit-capabilities.ts';
import { requireUnitDefinition, type UnitCatalog } from '../unit/unit-catalog.ts';
import type { UnitDefinition } from '../unit/unit-definition.ts';
import type { Unit } from '../unit/unit.ts';
import type { SystemState } from './system-state.ts';

interface ResolvedUnit {
  readonly unit: Unit;
  readonly definition: UnitDefinition;
}

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/**
 * Information Expert für ein System: Es kennt seine Einheiten und
 * berechnet selbst Flottenlimit (Regel 28) und Kapazität (Regel 43).
 */
export class StarSystem {
  private constructor(
    readonly state: SystemState,
    private readonly space: readonly ResolvedUnit[],
    private readonly onPlanets: readonly ResolvedUnit[],
  ) {}

  static inspect(
    state: SystemState,
    planets: readonly PlanetState[],
    catalog: UnitCatalog,
  ): Result<StarSystem, DomainError> {
    const resolve = (unit: Unit): Result<ResolvedUnit, DomainError> =>
      map(requireUnitDefinition(catalog, unit.type), (definition) => ({ unit, definition }));
    const space = combine(state.spaceUnits.map(resolve));
    const ground = combine(planets.flatMap((planet) => planet.units).map(resolve));
    if (!space.ok) return space;
    if (!ground.ok) return ground;
    return ok(new StarSystem(state, space.value, ground.value));
  }

  shipsOf(owner: PlayerId): readonly Unit[] {
    return this.spaceOf(owner)
      .filter(({ definition }) => isShip(definition))
      .map(({ unit }) => unit);
  }

  hasShipsOf(owner: PlayerId): boolean {
    return this.shipsOf(owner).length > 0;
  }

  /** Spieler (außer `viewer`) mit Schiffen in diesem System. */
  opponentsWithShips(viewer: PlayerId): readonly PlayerId[] {
    const owners = new Set(
      this.space.filter((entry) => isShip(entry.definition)).map((entry) => entry.unit.owner),
    );
    owners.delete(viewer);
    return [...owners];
  }

  nonFighterShipCount(owner: PlayerId): number {
    return this.spaceOf(owner).filter(({ definition }) => countsTowardFleetLimit(definition))
      .length;
  }

  exceedsFleetLimit(owner: PlayerId, fleetPoolTokens: number): boolean {
    return this.nonFighterShipCount(owner) > fleetPoolTokens;
  }

  capacity(owner: PlayerId): number {
    const shipCapacity = sum(this.spaceOf(owner).map(({ definition }) => definition.capacity ?? 0));
    return shipCapacity + this.hangarAllowance(owner);
  }

  capacityUsage(owner: PlayerId): number {
    return this.spaceOf(owner).filter(({ definition }) => occupiesCapacity(definition)).length;
  }

  exceedsCapacity(owner: PlayerId): boolean {
    return this.capacityUsage(owner) > this.capacity(owner);
  }

  hasCommandToken(player: PlayerId): boolean {
    return this.state.commandTokens.includes(player);
  }

  /** Gebäude mit Hangar (z. B. Raumdock) erlauben Jäger ohne Trägerkapazität. */
  private hangarAllowance(owner: PlayerId): number {
    const hangars = this.onPlanets
      .filter((entry) => entry.unit.owner === owner)
      .map(({ definition }) => findCapability(definition, 'fighterHangar')?.fighters ?? 0);
    const fightersInSpace = this.spaceOf(owner).filter(
      ({ definition }) => definition.isFighter,
    ).length;
    return Math.min(sum(hangars), fightersInSpace);
  }

  private spaceOf(owner: PlayerId): readonly ResolvedUnit[] {
    return this.space.filter((entry) => entry.unit.owner === owner);
  }
}
