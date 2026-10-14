import type { RewardEffect } from '../exploration/exploration-definition.ts';
import type { FactionAbility } from '../faction/faction-ability.ts';
import type { PlanetTrait } from '../planet/planet-definition.ts';
import type { FactionId, LeaderId, UnitTypeId } from '../shared/ids.ts';

/** PoK Anführer: je Fraktion ein Agent, ein Kommandant und ein Held. */
export type LeaderKind = 'agent' | 'commander' | 'hero';

export const LEADER_KINDS: readonly LeaderKind[] = ['agent', 'commander', 'hero'];

/**
 * Freischaltbedingung als Daten (Interpreter in `leader-unlock.ts`). Jede Bedingung zählt
 * etwas und verlangt mindestens `count` davon; so lässt sich der Fortschritt anzeigen.
 */
export type UnlockCondition =
  /** Kontrollierte Planeten, auf Wunsch nur einer Eigenschaft. */
  | { readonly kind: 'controlPlanets'; readonly count: number; readonly trait?: PlanetTrait }
  | { readonly kind: 'ownTechnologies'; readonly count: number }
  /** Eigene Einheiten dieses Typs auf dem Spielplan (Weltraum und Planeten). */
  | { readonly kind: 'unitsOnBoard'; readonly unit: UnitTypeId; readonly count: number }
  /** Kontrollierte Planeten im Zentrum oder legendäre Planeten. */
  | { readonly kind: 'controlSpecialPlanets'; readonly count: number }
  /** Gewertete Aufträge, öffentliche und geheime. */
  | { readonly kind: 'scoredObjectives'; readonly count: number };

export type UnlockKind = UnlockCondition['kind'];

/** PoK Held: wird frei, sobald der Spieler mindestens drei Aufträge gewertet hat. */
export const HERO_OBJECTIVES = 3;

export const HERO_UNLOCK: UnlockCondition = { kind: 'scoredObjectives', count: HERO_OBJECTIVES };

interface LeaderBase {
  readonly id: LeaderId;
  readonly faction: FactionId;
}

/** Agent: ab Spielbeginn bereit; Komponentenaktion, danach erschöpft bis zur Statusphase. */
export interface AgentDefinition extends LeaderBase {
  readonly kind: 'agent';
  readonly action: readonly RewardEffect[];
}

/**
 * Kommandant: gesperrt, bis `unlock` erfüllt ist; danach gilt `passive` dauerhaft wie eine
 * weitere Fraktionsfähigkeit (Einheitenwerte, Regelwerte, Einsatz von Einheiten).
 */
export interface CommanderDefinition extends LeaderBase {
  readonly kind: 'commander';
  readonly unlock: UnlockCondition;
  readonly passive: Omit<FactionAbility, 'id'>;
}

/** Held: gesperrt bis drei Aufträge; einmalige Komponentenaktion, danach aus dem Spiel. */
export interface HeroDefinition extends LeaderBase {
  readonly kind: 'hero';
  readonly action: readonly RewardEffect[];
}

export type LeaderDefinition = AgentDefinition | CommanderDefinition | HeroDefinition;

/** Bedingung, unter der ein Anführer frei wird; Agenten sind es von Anfang an. */
export function unlockOf(leader: LeaderDefinition): UnlockCondition | null {
  if (leader.kind === 'commander') return leader.unlock;
  return leader.kind === 'hero' ? HERO_UNLOCK : null;
}
