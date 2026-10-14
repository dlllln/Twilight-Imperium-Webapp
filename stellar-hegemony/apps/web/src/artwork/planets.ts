import type { PlanetLook } from '../render/planet-texture.ts';

/** Crop only the planet illustration; original names, resource icons and numbers stay outside. */
export const PLANET_ART_CROPS: Readonly<
  Record<
    PlanetLook,
    { readonly path: string; readonly x: number; readonly y: number; readonly size: number }
  >
> = {
  industrial: { path: '/ti4/tiles/19_Wellon.png', x: 122, y: 100, size: 100 },
  hazardous: { path: '/ti4/tiles/20_VefutII.png', x: 122, y: 100, size: 100 },
  cultural: { path: '/ti4/tiles/24_MeharXull.png', x: 122, y: 100, size: 100 },
  plain: { path: '/ti4/tiles/01_Jord.png', x: 123, y: 79, size: 98 },
  center: { path: '/ti4/tiles/18_MR.png', x: 70, y: 48, size: 204 },
};

export const PLANET_ARTWORK_PATHS: readonly string[] = Object.values(PLANET_ART_CROPS).map(
  ({ path }) => path,
);
