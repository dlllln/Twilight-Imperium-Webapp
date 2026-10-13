import { createBaseContent } from '@stellar/content';
import {
  assembleGalaxy,
  type ContentPort,
  type DomainError,
  formatMapString,
  generateGalaxyLayout,
  type MapLayout,
  parseMapString,
  andThen,
  map,
  type Result,
} from '@stellar/domain';
import { SeededRandom } from '@stellar/infrastructure';
import { create, type StoreApi } from 'zustand';
import type { Point } from './hex-geometry.ts';
import type { Language } from './i18n.ts';
import { zoomAround } from './system/viewport-tween.ts';

export const content: ContentPort = createBaseContent();

export interface Viewport {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export const DEFAULT_VIEWPORT: Viewport = { zoom: 1, panX: 0, panY: 0 };
const MAP_ORIGIN: Point = { x: 0, y: 0 };
const DEFAULT_PLAYERS = 6;

export interface GalaxyStore {
  readonly language: Language;
  readonly playerCount: number;
  readonly seed: number;
  readonly layout: MapLayout;
  readonly error: DomainError | null;
  readonly hovered: string | null;
  readonly viewport: Viewport;
  readonly setLanguage: (language: Language) => void;
  readonly setPlayerCount: (count: number) => void;
  readonly generate: (seed?: number) => void;
  readonly importMap: (mapString: string) => boolean;
  readonly hover: (key: string | null) => void;
  /** Zoomt um `factor`; `anchor` (viewBox-Koordinaten) bleibt stehen, sonst die Kartenmitte. */
  readonly zoomBy: (factor: number, anchor?: Point) => void;
  readonly panBy: (dx: number, dy: number) => void;
  readonly resetView: () => void;
  /** Setzt die Ansicht direkt, z. B. während der Kamerafahrt in ein System. */
  readonly setViewport: (viewport: Viewport) => void;
}

/** Validiert über dieselbe Domain-Logik wie der Server. */
function validated(
  layout: Result<MapLayout, DomainError>,
  players: number,
): Result<MapLayout, DomainError> {
  return andThen(layout, (candidate) =>
    map(assembleGalaxy(candidate, content.tiles, players), () => candidate),
  );
}

function generated(players: number, seed: number): Result<MapLayout, DomainError> {
  const template = content.galaxyTemplate(players);
  if (template === undefined)
    return { ok: false, error: { code: 'galaxy.noTemplate', message: '' } };
  return validated(generateGalaxyLayout(template, content.tiles, new SeededRandom(seed)), players);
}

const homeCount = (layout: MapLayout): number =>
  layout.filter((slot) => slot.content.kind === 'home').length;

export const nextSeed = (): number => Math.floor(Math.random() * 2 ** 31);

type Set = StoreApi<GalaxyStore>['setState'];
type Get = StoreApi<GalaxyStore>['getState'];
type GalaxyActions = Pick<GalaxyStore, 'setPlayerCount' | 'generate' | 'importMap'>;
type ViewActions = Pick<
  GalaxyStore,
  'setLanguage' | 'hover' | 'zoomBy' | 'panBy' | 'resetView' | 'setViewport'
>;

function importedLayout(mapString: string, fallbackPlayers: number): Partial<GalaxyStore> {
  const parsed = parseMapString(mapString);
  const players = parsed.ok ? homeCount(parsed.value) : fallbackPlayers;
  const result = validated(parsed, players);
  return result.ok
    ? { layout: result.value, playerCount: players, error: null }
    : { error: result.error };
}

const galaxyActions = (set: Set, get: Get): GalaxyActions => ({
  setPlayerCount: (playerCount) => {
    set({ playerCount });
    get().generate();
  },
  generate: (seed = nextSeed()) => {
    const result = generated(get().playerCount, seed);
    set(result.ok ? { layout: result.value, seed, error: null } : { error: result.error });
  },
  importMap: (mapString) => {
    set(importedLayout(mapString, get().playerCount));
    return get().error === null;
  },
});

const withViewport = (set: Set, change: (viewport: Viewport) => Viewport): void =>
  set(({ viewport }) => ({ viewport: change(viewport) }));

const viewActions = (set: Set): ViewActions => ({
  setLanguage: (language) => set({ language }),
  hover: (hovered) => set({ hovered }),
  zoomBy: (factor, anchor = MAP_ORIGIN) => withViewport(set, (v) => zoomAround(v, factor, anchor)),
  panBy: (dx, dy) => withViewport(set, (v) => ({ ...v, panX: v.panX + dx, panY: v.panY + dy })),
  resetView: () => set({ viewport: DEFAULT_VIEWPORT }),
  setViewport: (viewport) => set({ viewport }),
});

export const useGalaxyStore = create<GalaxyStore>()((set, get) => ({
  language: 'de',
  playerCount: DEFAULT_PLAYERS,
  seed: 1,
  layout: [],
  error: null,
  hovered: null,
  viewport: DEFAULT_VIEWPORT,
  ...galaxyActions(set, get),
  ...viewActions(set),
}));

export const currentMapString = (layout: MapLayout): string => formatMapString(layout);
