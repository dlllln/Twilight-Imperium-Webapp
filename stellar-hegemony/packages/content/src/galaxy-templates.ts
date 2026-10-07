import {
  areAdjacentHexes,
  type GalaxyTemplate,
  type Hex,
  hexEquals,
  hexRing,
  hexSpiral,
  ORIGIN,
} from '@stellar/domain';

const GALAXY_RADIUS = 3;
const OUTER_RING = hexRing(ORIGIN, GALAXY_RADIUS);

/** Heimat-Plätze als Indizes im äußeren Ring (0 = Norden, im Uhrzeigersinn). */
const HOME_RING_INDICES: Readonly<Record<number, readonly number[]>> = {
  3: [0, 6, 12],
  4: [1, 8, 10, 17],
  5: [0, 4, 7, 11, 14],
  6: [0, 3, 6, 9, 12, 15],
};

/** Ausgeteilte Systemtafeln insgesamt (blau/rot) je Spielerzahl. */
const TILE_COUNTS: Readonly<Record<number, { readonly blue: number; readonly red: number }>> = {
  3: { blue: 18, red: 6 },
  4: { blue: 20, red: 12 },
  5: { blue: 20, red: 11 },
  6: { blue: 18, red: 12 },
};

const ringPositions = (indices: readonly number[]): readonly Hex[] =>
  indices.map((index) => OUTER_RING[index]).filter((hex) => hex !== undefined);

/** Bei 3 Spielern bleibt der äußere Ring bis auf die Felder neben den Heimat-Plätzen leer. */
function systemSlots(homes: readonly Hex[], playerCount: number): readonly Hex[] {
  const free = hexSpiral(ORIGIN, GALAXY_RADIUS).filter(
    (hex) => !hexEquals(hex, ORIGIN) && !homes.some((home) => hexEquals(home, hex)),
  );
  if (playerCount > 3) return free;
  const inner = (hex: Hex) => !OUTER_RING.some((outer) => hexEquals(outer, hex));
  return free.filter((hex) => inner(hex) || homes.some((home) => areAdjacentHexes(home, hex)));
}

export function galaxyTemplate(playerCount: number): GalaxyTemplate | undefined {
  const indices = HOME_RING_INDICES[playerCount];
  const counts = TILE_COUNTS[playerCount];
  if (indices === undefined || counts === undefined) return undefined;
  const homeSlots = ringPositions(indices);
  return {
    playerCount,
    homeSlots,
    systemSlots: systemSlots(homeSlots, playerCount),
    blueTiles: counts.blue,
    redTiles: counts.red,
  };
}
