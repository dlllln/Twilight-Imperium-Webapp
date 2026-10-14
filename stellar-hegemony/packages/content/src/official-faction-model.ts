import type { LeaderKind } from '@stellar/domain';
import type { LocalizedText } from './localized.ts';

export interface OfficialFactionSeed {
  readonly id: string;
  readonly name: LocalizedText;
  readonly edition: 'base' | 'pok' | 'codex' | 'te';
  readonly archetype: string;
  readonly complexity: 1 | 2 | 3;
  readonly commodities: number;
  readonly home: readonly {
    readonly alias: string;
    readonly name: string;
    readonly resources: number;
    readonly influence: number;
  }[];
  readonly space: readonly (readonly [string, number])[];
  readonly ground: readonly {
    readonly planet: string;
    readonly units: readonly (readonly [string, number])[];
  }[];
  readonly technologies: readonly string[];
  readonly originalTechnologies: readonly string[];
  readonly technologyChoice: number;
  readonly leaders: readonly {
    readonly kind: LeaderKind;
    readonly id: string;
    readonly name: string;
  }[];
  readonly source: string;
}
