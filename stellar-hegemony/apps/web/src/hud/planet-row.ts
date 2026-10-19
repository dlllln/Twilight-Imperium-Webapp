import {
  type ContentPort,
  currentPlanetDefinition,
  type GameState,
  homeSystemIdOf,
  type PlanetDefinition,
  type PlanetId,
  type PlanetState,
  type PlanetTrait,
  type PlayerId,
  type SystemTile,
  type TechnologyColor,
} from '@stellar/domain';
import { type Language, translate } from '../i18n.ts';
import { planetLabel } from '../labels.ts';
import { planetLookOf } from '../render/scene-model.ts';
import type { PlanetLook } from '../render/planet-texture.ts';

/*
 * Die Planetenreihe vor dem eigenen Platz (reine Funktionen): jeder eigene Planet als Karte mit
 * seinen aktuellen Werten (samt angelegter Karten). Heimatplaneten liegen vorn, danach nach
 * System und Planet; die Reihenfolge hängt nie davon ab, ob gerade bezahlt wird.
 */

export interface PlanetCardView {
  readonly id: PlanetId;
  readonly resources: number;
  readonly influence: number;
  readonly look: PlanetLook;
  readonly trait: PlanetTrait | null;
  readonly specialty: TechnologyColor | null;
  readonly legendary: boolean;
  readonly exhausted: boolean;
  readonly home: boolean;
}

/** Wie die Reihe gerade liegt: zur Ansicht, beim Bezahlen oder beim Bereitmachen. */
export type RowMode = 'rest' | 'pay' | 'ready';

/** Drehung einer Karte in Grad: erschöpft quer, vorgemerkt schräg, Vorschau aufgerichtet. */
export type CardTurn = 0 | 30 | 90;

interface Placed {
  readonly view: PlanetCardView;
  readonly system: string;
}

/** Zu jedem Planeten seine Systemtafel. */
function planetTiles(content: ContentPort): ReadonlyMap<string, SystemTile> {
  const tiles = new Map<string, SystemTile>();
  for (const tile of content.tiles.all()) {
    for (const planet of tile.planets) tiles.set(planet.id, tile);
  }
  return tiles;
}

function viewOf(
  planet: PlanetState,
  definition: PlanetDefinition,
  tile: SystemTile | undefined,
  home: boolean,
): PlanetCardView {
  return {
    id: planet.id,
    resources: definition.resources,
    influence: definition.influence,
    look: planetLookOf(definition, tile?.back ?? 'blue'),
    trait: definition.trait ?? null,
    specialty: definition.technologySpecialty ?? null,
    legendary: definition.legendary !== undefined,
    exhausted: planet.exhausted,
    home,
  };
}

const bySystemAndId = (a: Placed, b: Placed): number =>
  Number(b.view.home) - Number(a.view.home) ||
  a.system.localeCompare(b.system, 'en', { numeric: true }) ||
  a.view.id.localeCompare(b.view.id, 'en');

/** Die eigenen Planeten als Karten, Heimatplaneten zuerst. */
export function planetRow(
  game: GameState,
  viewer: PlayerId,
  content: ContentPort,
): readonly PlanetCardView[] {
  const tiles = planetTiles(content);
  const homeId = homeSystemIdOf(game, viewer, content);
  const placed = Object.values(game.planets).flatMap((planet): Placed[] => {
    const definition = currentPlanetDefinition(game, content.tiles, planet.id);
    if (planet.controller !== viewer || definition === undefined) return [];
    const tile = tiles.get(planet.id);
    const view = viewOf(planet, definition, tile, tile !== undefined && tile.id === homeId);
    return [{ view, system: tile?.id ?? '' }];
  });
  return placed.sort(bySystemAndId).map((entry) => entry.view);
}

/** Name und Werte einer Karte für Bildschirmleser; erschöpfte tragen den Zusatz. */
export function planetCardText(view: PlanetCardView, language: Language): string {
  const text = translate(language, 'planetCardLabel')
    .replace('{planet}', planetLabel(view.id, language))
    .replace('{resources}', String(view.resources))
    .replace('{influence}', String(view.influence));
  return view.exhausted ? `${text}, ${translate(language, 'exhausted')}` : text;
}

/** Vorgemerkt beim Bezahlen schräg, beim Bereitmachen aufgerichtet; sonst erschöpft quer. */
export function cardTurn(view: PlanetCardView, mode: RowMode, chosen: boolean): CardTurn {
  if (chosen && mode === 'pay') return 30;
  if (chosen && mode === 'ready') return 0;
  return view.exhausted ? 90 : 0;
}
