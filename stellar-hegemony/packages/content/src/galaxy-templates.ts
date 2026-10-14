import {
  areAdjacentHexes,
  type GalaxyTemplate,
  type Hex,
  hexEquals,
  hexRing,
  hexSpiral,
  ORIGIN,
} from '@stellar/domain';

/** Bis 6 Spieler reicht ein Radius von 3; ab 7 Spielern liegt ein vierter Ring außen. */
const GALAXY_RADIUS = 3;
const LARGE_GALAXY_RADIUS = 4;
const LARGE_FROM_PLAYERS = 7;

/** Heimat-Plätze als Indizes im äußeren Ring (0 = Norden, im Uhrzeigersinn). */
const HOME_RING_INDICES: Readonly<Record<number, readonly number[]>> = {
  3: [0, 6, 12],
  4: [1, 8, 10, 17],
  5: [0, 4, 7, 11, 14],
  6: [0, 3, 6, 9, 12, 15],
  // Ring 4 hat 24 Felder: bei 7 Spielern abwechselnd 3 und 4 Felder Abstand, bei 8 immer 3.
  7: [0, 3, 7, 10, 14, 17, 21],
  8: [0, 3, 6, 9, 12, 15, 18, 21],
};

/** Ausgeteilte Systemtafeln insgesamt (blau/rot) je Spielerzahl. */
const TILE_COUNTS: Readonly<Record<number, { readonly blue: number; readonly red: number }>> = {
  3: { blue: 18, red: 6 },
  4: { blue: 20, red: 12 },
  5: { blue: 20, red: 11 },
  6: { blue: 18, red: 12 },
  7: { blue: 33, red: 17 },
  8: { blue: 34, red: 18 },
};

const radiusFor = (playerCount: number): number =>
  playerCount >= LARGE_FROM_PLAYERS ? LARGE_GALAXY_RADIUS : GALAXY_RADIUS;

const ringPositions = (ring: readonly Hex[], indices: readonly number[]): readonly Hex[] =>
  indices.map((index) => ring[index]).filter((hex) => hex !== undefined);

/** Bei 3 Spielern und ab 7 Spielern bleibt der äußere Ring nur neben den Heimat-Plätzen belegt. */
const fullOuterRing = (playerCount: number): boolean =>
  playerCount > 3 && playerCount < LARGE_FROM_PLAYERS;

function systemSlots(homes: readonly Hex[], playerCount: number): readonly Hex[] {
  const radius = radiusFor(playerCount);
  const outer = hexRing(ORIGIN, radius);
  const free = hexSpiral(ORIGIN, radius).filter(
    (hex) => !hexEquals(hex, ORIGIN) && !homes.some((home) => hexEquals(home, hex)),
  );
  if (fullOuterRing(playerCount)) return free;
  const inner = (hex: Hex) => !outer.some((ring) => hexEquals(ring, hex));
  return free.filter((hex) => inner(hex) || homes.some((home) => areAdjacentHexes(home, hex)));
}

export function galaxyTemplate(playerCount: number): GalaxyTemplate | undefined {
  const indices = HOME_RING_INDICES[playerCount];
  const counts = TILE_COUNTS[playerCount];
  if (indices === undefined || counts === undefined) return undefined;
  const homeSlots = ringPositions(hexRing(ORIGIN, radiusFor(playerCount)), indices);
  return {
    playerCount,
    homeSlots,
    systemSlots: systemSlots(homeSlots, playerCount),
    blueTiles: counts.blue,
    redTiles: counts.red,
  };
}
