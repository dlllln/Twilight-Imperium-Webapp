import { areAdjacentHexes, type Hex, ORIGIN } from '../hex/hex-coordinate.ts';
import { type RandomPort, shuffle } from '../ports/random-port.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { violatesPlacement } from './adjacency.ts';
import type { GalaxyTemplate, MapLayout, MapSlot } from './map-layout.ts';
import type { SystemTile, TileBack } from './system-tile.ts';
import type { TileCatalog } from './tile-catalog.ts';

interface Placement {
  readonly position: Hex;
  readonly tile: SystemTile;
}

const ofBack = (tiles: TileCatalog, back: TileBack): readonly SystemTile[] =>
  tiles.all().filter((tile) => tile.back === back);

function conflicts(candidate: SystemTile, position: Hex, placed: readonly Placement[]): boolean {
  return placed.some(
    (other) =>
      areAdjacentHexes(other.position, position) && violatesPlacement(candidate, other.tile),
  );
}

/** Suchbudget, nach dem die Suche die bisher beste Teil-Lösung gierig vervollständigt. */
const SEARCH_BUDGET = 20_000;

interface Search {
  readonly slots: readonly Hex[];
  steps: number;
}

const signatureOf = (tile: SystemTile): string => `${tile.anomaly ?? ''}|${tile.wormholes.join()}`;

/** Backtracking: legt Tafeln so, dass keine Aufbauregel verletzt wird. */
function search(state: Search, placed: Placement[], remaining: readonly SystemTile[]): boolean {
  const position = state.slots[placed.length];
  if (position === undefined) return true;
  const tried = new Set<string>();
  return remaining.some((tile, index) => {
    const skip = tried.has(signatureOf(tile)) || conflicts(tile, position, placed);
    if (skip || state.steps++ > SEARCH_BUDGET) return false;
    tried.add(signatureOf(tile));
    placed.push({ position, tile });
    const rest = remaining.filter((_, other) => other !== index);
    if (search(state, placed, rest)) return true;
    placed.pop();
    return false;
  });
}

/** Ohne konfliktfreie Lösung: nimmt jeweils die erste passende, sonst die nächste Tafel. */
function placeGreedily(slots: readonly Hex[], tiles: readonly SystemTile[]): readonly Placement[] {
  const remaining = [...tiles];
  const placed: Placement[] = [];
  for (const position of slots) {
    const fitting = remaining.findIndex((tile) => !conflicts(tile, position, placed));
    const [tile] = remaining.splice(Math.max(fitting, 0), 1);
    if (tile !== undefined) placed.push({ position, tile });
  }
  return placed;
}

function placeTiles(slots: readonly Hex[], tiles: readonly SystemTile[]): readonly Placement[] {
  const placed: Placement[] = [];
  return search({ slots, steps: 0 }, placed, [...tiles]) ? placed : placeGreedily(slots, tiles);
}

function drawTiles(
  template: GalaxyTemplate,
  tiles: TileCatalog,
  random: RandomPort,
): Result<readonly SystemTile[], DomainError> {
  const blue = shuffle(random, ofBack(tiles, 'blue')).slice(0, template.blueTiles);
  const red = shuffle(random, ofBack(tiles, 'red')).slice(0, template.redTiles);
  const drawn = shuffle(random, [...blue, ...red]);
  const complete = blue.length === template.blueTiles && red.length === template.redTiles;
  if (!complete || drawn.length !== template.systemSlots.length) {
    return err(domainError('galaxy.notEnoughTiles', 'Zu wenige Systemtafeln für diese Vorlage'));
  }
  return ok(drawn);
}

const tileSlot = (position: Hex, tile: SystemTile): MapSlot => ({
  position,
  content: { kind: 'tile', tileId: tile.id },
});

/** Factory: erzeugt eine zufällige, regelkonforme Galaxie aus einer Vorlage. */
export function generateGalaxyLayout(
  template: GalaxyTemplate,
  tiles: TileCatalog,
  random: RandomPort,
): Result<MapLayout, DomainError> {
  const [center] = ofBack(tiles, 'center');
  if (center === undefined) return err(domainError('galaxy.noCenter', 'Keine Zentrumstafel'));
  const drawn = drawTiles(template, tiles, random);
  if (!drawn.ok) return drawn;
  const homes = template.homeSlots.map((position): MapSlot => ({
    position,
    content: { kind: 'home' },
  }));
  const placed = placeTiles(template.systemSlots, drawn.value);
  return ok([
    tileSlot(ORIGIN, center),
    ...homes,
    ...placed.map((p) => tileSlot(p.position, p.tile)),
  ]);
}
