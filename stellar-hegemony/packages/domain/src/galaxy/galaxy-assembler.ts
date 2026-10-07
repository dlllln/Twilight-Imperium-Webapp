import { type Hex, hexEquals, hexKey, ORIGIN } from '../hex/hex-coordinate.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import { combine, err, map, ok, type Result } from '../shared/result.ts';
import type { GalaxyAssembled, PlacedSystem } from './galaxy-events.ts';
import type { MapLayout, MapSlot } from './map-layout.ts';
import type { SystemTile } from './system-tile.ts';
import type { TileCatalog } from './tile-catalog.ts';

interface TilePlacement {
  readonly position: Hex;
  readonly tile: SystemTile;
}

function resolveTile(slot: MapSlot, tiles: TileCatalog): Result<TilePlacement | null, DomainError> {
  if (slot.content.kind === 'home') return ok(null);
  const tile = tiles.find(slot.content.tileId);
  if (tile === undefined) {
    return err(
      domainError('galaxy.unknownTile', `Unbekannte Systemtafel: ${slot.content.tileId}`, {
        tile: slot.content.tileId,
      }),
    );
  }
  return ok({ position: slot.position, tile });
}

const isUnique = (values: readonly string[]): boolean => new Set(values).size === values.length;

function uniquenessChecks(
  layout: MapLayout,
  placements: readonly TilePlacement[],
): readonly Check[] {
  const ids = placements.map(({ tile }) => tile.id);
  const positions = layout.map((slot) => hexKey(slot.position));
  return [
    guard(isUnique(ids), 'galaxy.duplicateTile', 'Eine Systemtafel liegt doppelt'),
    guard(isUnique(positions), 'galaxy.duplicatePosition', 'Ein Feld ist doppelt belegt'),
  ];
}

function structureChecks(
  placements: readonly TilePlacement[],
  homes: number,
  playerCount: number,
): readonly Check[] {
  const centers = placements.filter(({ tile }) => tile.back === 'center');
  const centered = centers.length === 1 && centers.every((c) => hexEquals(c.position, ORIGIN));
  return [
    guard(centered, 'galaxy.center', 'Genau eine Zentrumstafel muss in der Mitte liegen'),
    guard(
      placements.every(({ tile }) => tile.back !== 'home'),
      'galaxy.homeTile',
      'Heimat-Systeme nur über H-Plätze',
    ),
    guard(homes === playerCount, 'galaxy.homeSlots', 'Heimat-Plätze passen nicht zur Spielerzahl', {
      homes,
      playerCount,
    }),
  ];
}

const toPlacedSystem = ({ position, tile }: TilePlacement): PlacedSystem => ({
  id: tile.id,
  position,
  planetIds: tile.planets.map((planet) => planet.id),
  wormholes: tile.wormholes,
  ...(tile.anomaly === undefined ? {} : { anomaly: tile.anomaly }),
});

const homeSlotsOf = (layout: MapLayout): readonly Hex[] =>
  layout.filter((slot) => slot.content.kind === 'home').map((slot) => slot.position);

/** Builder: prüft ein Layout gegen die Tafeln und erzeugt das GalaxyAssembled-Event. */
export function assembleGalaxy(
  layout: MapLayout,
  tiles: TileCatalog,
  playerCount: number,
): Result<GalaxyAssembled, DomainError> {
  const resolved = combine(layout.map((slot) => resolveTile(slot, tiles)));
  if (!resolved.ok) return resolved;
  const placements = resolved.value.filter((placement) => placement !== null);
  const homeSlots = homeSlotsOf(layout);
  const checked = firstFailure([
    ...uniquenessChecks(layout, placements),
    ...structureChecks(placements, homeSlots.length, playerCount),
  ]);
  return map(checked, () => ({
    type: 'GalaxyAssembled',
    systems: placements.map(toPlacedSystem),
    homeSlots,
  }));
}
