import { planetName } from '@stellar/content';
import type {
  AnomalyKind,
  ContentPort,
  Hex,
  MapLayout,
  PlanetDefinition,
  SystemTile,
  WormholeKind,
} from '@stellar/domain';
import type { Language } from './i18n.ts';

export interface PlanetView {
  readonly name: string;
  readonly definition: PlanetDefinition;
}

export type SlotView =
  | { readonly kind: 'home'; readonly key: string; readonly position: Hex; readonly seat: number }
  | {
      readonly kind: 'system';
      readonly key: string;
      readonly position: Hex;
      readonly tileId: string;
      readonly back: string;
      readonly planets: readonly PlanetView[];
      readonly anomaly?: AnomalyKind;
      readonly wormholes: readonly WormholeKind[];
    };

const planetView = (definition: PlanetDefinition, language: Language): PlanetView => ({
  name: planetName(definition.id)?.[language] ?? definition.id,
  definition,
});

function systemView(key: string, position: Hex, tile: SystemTile, language: Language): SlotView {
  const planets = tile.planets.map((planet) => planetView(planet, language));
  const base = {
    kind: 'system',
    key,
    position,
    tileId: tile.id,
    back: tile.back,
    planets,
    wormholes: tile.wormholes,
  } as const;
  return tile.anomaly === undefined ? base : { ...base, anomaly: tile.anomaly };
}

/** Übersetzt ein Layout in darstellbare Felder (reine Präsentationslogik). */
export function toSlotViews(
  layout: MapLayout,
  content: ContentPort,
  language: Language,
): readonly SlotView[] {
  let seat = 0;
  return layout.flatMap((slot): SlotView[] => {
    const key = `${slot.position.q},${slot.position.r}`;
    if (slot.content.kind === 'home')
      return [{ kind: 'home', key, position: slot.position, seat: ++seat }];
    const tile = content.tiles.find(slot.content.tileId);
    return tile === undefined ? [] : [systemView(key, slot.position, tile, language)];
  });
}
