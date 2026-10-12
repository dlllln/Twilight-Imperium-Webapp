import { hashString, seededRandom } from './noise.ts';
import type { Rgb } from './palette.ts';
import type { PlanetLook } from './planet-texture.ts';

/*
 * Charakter eines Planeten (reine Funktion): Aus Art und Name folgt eine Welt mit eigener
 * Gestalt – Ozeanwelt, Archipel, Wüste mit Dünen, Lavawelt, Eismond, Gasriese mit Ring …
 * Der Farbton schwankt nur leicht, damit die Art (blau, rot, grün) erkennbar bleibt.
 */

export interface PlanetStyle {
  /** Meeresspiegel (0 = kein Wasser). */
  readonly ocean: number;
  /** Polkappen (0 bis 1). */
  readonly ice: number;
  /** Krater (0 bis 1). */
  readonly craters: number;
  /** Bänder wie bei Gasriesen oder Dünen (0 bis 1). */
  readonly bands: number;
  /** Wolkendecke als Faktor auf die Art. */
  readonly clouds: number;
  /** Wie zerklüftet die Oberfläche ist (Frequenz des Rauschens). */
  readonly roughness: number;
  /** Ring um den Planeten (0 oder 1) und seine Neigung im Bogenmaß. */
  readonly ring: number;
  readonly ringTilt: number;
  /** Farbtonverschiebung in Grad. */
  readonly hue: number;
  /** Faktor auf den Durchmesser: große und kleine Welten. */
  readonly size: number;
}

type Archetype = Pick<
  PlanetStyle,
  'ocean' | 'ice' | 'craters' | 'bands' | 'clouds' | 'roughness'
> & {
  readonly ringChance: number;
};

const world = (shape: Partial<Archetype>): Archetype => ({
  ocean: 0,
  ice: 0,
  craters: 0,
  bands: 0,
  clouds: 1,
  roughness: 1,
  ringChance: 0,
  ...shape,
});

/** Mögliche Welten je Art; welche es wird, entscheidet der Name. */
const ARCHETYPES: Readonly<Record<PlanetLook, readonly Archetype[]>> = {
  cultural: [
    world({ ocean: 0.6, clouds: 1.2 }),
    world({ ocean: 0.46 }),
    world({ ocean: 0.56, roughness: 1.8, clouds: 0.8 }),
    world({ ocean: 0.38, ice: 0.7, clouds: 0.9 }),
  ],
  industrial: [
    world({ ocean: 0.3, roughness: 1.2 }),
    world({ ocean: 0.12, bands: 0.3, clouds: 0.6 }),
    world({ ocean: 0.08, roughness: 2, craters: 0.25, clouds: 0.5 }),
    world({ ocean: 0.22, ice: 0.9, clouds: 0.8 }),
  ],
  hazardous: [
    world({ roughness: 1.6, clouds: 0.4 }),
    world({ bands: 0.45, clouds: 0.3, roughness: 0.8 }),
    world({ clouds: 2.4, roughness: 0.7, ringChance: 0.3 }),
    world({ bands: 1, clouds: 0, roughness: 0.6, ringChance: 0.6 }),
  ],
  plain: [
    world({ craters: 0.8, clouds: 0.2, roughness: 1.4 }),
    world({ ice: 1, craters: 0.35, clouds: 0.3 }),
    world({ bands: 1, clouds: 0, roughness: 0.6, ringChance: 0.7 }),
  ],
  center: [world({ bands: 1, clouds: 0, roughness: 0.8, ringChance: 1 })],
};

const HUE_SWING = 16;
const SIZE_SWING = 0.12;

export function planetStyle(id: string, look: PlanetLook): PlanetStyle {
  const random = seededRandom(hashString(`${id}:style`));
  const choices = ARCHETYPES[look];
  const archetype = choices[Math.floor(random() * choices.length)] ?? world({});
  const { ringChance, ...shape } = archetype;
  return {
    ...shape,
    ring: random() < ringChance ? 1 : 0,
    ringTilt: (random() - 0.5) * 0.9,
    hue: (random() * 2 - 1) * HUE_SWING,
    size: 1 + (random() * 2 - 1) * SIZE_SWING,
  };
}

/** Matrix des CSS-Filters `hue-rotate`: je Ausgabekanal und Eingabekanal Grundwert, cos- und sin-Anteil. */
const HUE_MATRIX: readonly (readonly (readonly [number, number, number])[])[] = [
  [
    [0.213, 0.787, -0.213],
    [0.715, -0.715, -0.715],
    [0.072, -0.072, 0.928],
  ],
  [
    [0.213, -0.213, 0.143],
    [0.715, 0.285, 0.14],
    [0.072, -0.072, -0.283],
  ],
  [
    [0.213, -0.213, -0.787],
    [0.715, -0.715, 0.715],
    [0.072, 0.928, 0.072],
  ],
];

/** Farbton drehen (wie der CSS-Filter `hue-rotate`): Helligkeit bleibt etwa gleich. */
export function hueRotate(color: Rgb, degrees: number): Rgb {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const [r, g, b] = HUE_MATRIX.map((row) =>
    row.reduce(
      (sum, [base, c, s], index) => sum + (color[index] ?? 0) * (base + c * cos + s * sin),
      0,
    ),
  ).map((value) => Math.min(255, Math.max(0, value)));
  return [r ?? 0, g ?? 0, b ?? 0];
}
