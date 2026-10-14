/** Original TI4 miniatures, served locally from the pinned AsyncTI4 asset snapshot. */
export const UNIT_ART_CODES: Readonly<Record<string, string>> = {
  flagship: 'fs',
  carrier: 'cv',
  cruiser: 'ca',
  destroyer: 'dd',
  dreadnought: 'dn',
  fighter: 'ff',
  sunbreaker: 'ws',
  infantry: 'gf',
  mech: 'mf',
  orbitalBattery: 'pd',
  orbitalDock: 'sd',
};

/** Matches the existing orange, sky blue, green, yellow, blue, red, purple, grey seats. */
export const UNIT_ART_COLORS = ['org', 'azr', 'grn', 'ylw', 'blu', 'red', 'ppl', 'gry'] as const;

const colorOfSeat = (seat: number): string =>
  UNIT_ART_COLORS[(seat - 1) % UNIT_ART_COLORS.length] ?? 'gry';

export function unitArtwork(type: string, seat: number): string | null {
  const code = UNIT_ART_CODES[type];
  return code === undefined ? null : `/ti4/units/${colorOfSeat(seat)}_${code}.png`;
}

export const UNIT_ARTWORK_PATHS: readonly string[] = UNIT_ART_COLORS.flatMap((color) =>
  Object.values(UNIT_ART_CODES).map((code) => `/ti4/units/${color}_${code}.png`),
);
