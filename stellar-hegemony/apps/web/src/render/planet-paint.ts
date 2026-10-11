import { hashString } from './noise.ts';
import type { Rgb } from './palette.ts';
import { ATMOSPHERE, FEATURES, type PlanetLook, RAMPS } from './planet-texture.ts';

/*
 * Werte für den Planeten-Shader (reine Funktion): dieselben Farbstufen und Merkmale wie der
 * Canvas-Maler, damit Karte, Fraktionswahl und Kampf denselben Planeten zeigen.
 */

export type Vec3 = readonly [number, number, number];

export interface PlanetPaint {
  /** Versatz im Rauschraum: jeder Planet bekommt seine eigene Oberfläche. */
  readonly seed: Vec3;
  readonly low: Vec3;
  readonly mid: Vec3;
  readonly high: Vec3;
  readonly atmosphere: Vec3;
  readonly night: Vec3;
  /** Wolken, Glanz, Nachtlichter (0/1), Bänder (0/1). */
  readonly features: readonly [number, number, number, number];
}

const CHANNEL = 255;
/** Größe des Raums, aus dem der Versatz stammt; klein genug für Gleitkomma im Shader. */
const SEED_SPACE = 97;
const SEED_STEPS = [1, 7, 13] as const;

const unit = ([r, g, b]: Rgb): Vec3 => [r / CHANNEL, g / CHANNEL, b / CHANNEL];

function seedOf(id: string): Vec3 {
  const hash = hashString(id);
  const [x, y, z] = SEED_STEPS.map((step) => ((hash >>> step) % SEED_SPACE) + 0.37 * step);
  return [x ?? 0, y ?? 0, z ?? 0];
}

export function planetPaint(id: string, look: PlanetLook): PlanetPaint {
  const [low, mid, high] = RAMPS[look];
  const features = FEATURES[look];
  return {
    seed: seedOf(id),
    low: unit(low),
    mid: unit(mid),
    high: unit(high),
    atmosphere: unit(ATMOSPHERE[look]),
    night: unit(features.night ?? [0, 0, 0]),
    features: [
      features.clouds,
      features.shine,
      features.night === null ? 0 : 1,
      look === 'center' ? 1 : 0,
    ],
  };
}
