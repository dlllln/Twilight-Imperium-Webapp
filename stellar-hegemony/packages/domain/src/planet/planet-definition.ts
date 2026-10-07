import type { PlanetId } from '../shared/ids.ts';

export type PlanetTrait = 'cultural' | 'hazardous' | 'industrial';

export type TechnologyColor = 'biotic' | 'propulsion' | 'cybernetic' | 'warfare';

/** Unveränderliche Stammdaten eines Planeten (aus dem Content-Paket). */
export interface PlanetDefinition {
  readonly id: PlanetId;
  readonly resources: number;
  readonly influence: number;
  readonly trait?: PlanetTrait;
  readonly technologySpecialty?: TechnologyColor;
}
