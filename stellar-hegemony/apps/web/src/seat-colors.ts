/** Okabe-Ito-Palette: auch bei Farbsehschwäche unterscheidbar. */
export const SEAT_COLORS: readonly string[] = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
  '#BBBBBB',
];

export const seatColor = (seat: number): string =>
  SEAT_COLORS[(seat - 1) % SEAT_COLORS.length] ?? '#FFFFFF';
