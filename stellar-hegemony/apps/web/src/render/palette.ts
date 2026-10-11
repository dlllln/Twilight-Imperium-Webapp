/** Gemeinsame Farben der Darstellung (Stimmung: Tiefraum, Gold, Spielerfarben). */
export const GOLD = 0xd9b45a;
export const GOLD_BRIGHT = 0xffe08a;
export const FRAME = 0x52618a;
export const TILE_BLUE = 0x0d1734;
export const TILE_RED = 0x22101f;
export const TILE_CENTER = 0x2c2410;
export const TILE_HOME = 0x0b1022;

export type Rgb = readonly [number, number, number];

export const rgbOf = (color: number): Rgb => [(color >> 16) & 255, (color >> 8) & 255, color & 255];

export const hexOf = (css: string): number => Number.parseInt(css.replace('#', ''), 16);

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const css = ([r, g, b]: Rgb, alpha = 1): string =>
  `rgba(${String(Math.round(r))},${String(Math.round(g))},${String(Math.round(b))},${String(alpha)})`;

/** Farbwert für Pixi aus drei Kanälen. */
export const colorOf = ([r, g, b]: Rgb): number =>
  (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
