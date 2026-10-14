import { describe, expect, it } from 'vitest';
import { LEADER_KINDS, type RewardEffect, unlockOf } from '@stellar/domain';
import {
  BASE_UNITS,
  createBaseContent,
  ALL_FACTIONS as FACTIONS,
  LEADERS,
  leaderText,
} from '../src/index.ts';

const unitIds = new Set(BASE_UNITS.map((unit) => unit.id));

/** Einheiten, die eine Anführer-Wirkung nennt (Einsatz, Bedingung, Kommandant). */
const unitsIn = (rewards: readonly RewardEffect[]) =>
  rewards.flatMap((reward) => (reward.kind === 'placeUnits' ? [reward.unit] : []));

describe('Content: Anführer (PoK Anführer)', () => {
  it('PoK Anführer: jede Fraktion hat genau einen Agenten, einen Kommandanten und einen Helden', () => {
    for (const faction of FACTIONS) {
      const own = LEADERS.filter((leader) => leader.faction === faction.id);
      expect(own.map((leader) => leader.kind)).toEqual(LEADER_KINDS);
    }
    expect(LEADERS).toHaveLength(FACTIONS.length * LEADER_KINDS.length);
    expect(new Set(LEADERS.map((leader) => leader.id)).size).toBe(LEADERS.length);
  });

  it('PoK Anführer: Name und Wirkung auf Deutsch und Englisch, Bedingung bei Kommandant und Held', () => {
    for (const leader of LEADERS) {
      const text = leaderText(leader.id);
      expect(text?.name.de.length).toBeGreaterThan(0);
      expect(text?.name.en.length).toBeGreaterThan(0);
      expect(text?.effect.de.length).toBeGreaterThan(0);
      expect(text?.effect.en.length).toBeGreaterThan(0);
      expect(text?.unlock === undefined).toBe(unlockOf(leader) === null);
    }
    expect(leaderText('unbekannt')).toBeUndefined();
  });

  it('PoK Anführer: Agenten und Helden haben eine Aktion, alle genannten Einheiten gibt es', () => {
    for (const leader of LEADERS) {
      const units =
        leader.kind === 'commander'
          ? [
              ...leader.passive.modifiers.flatMap((modifier) => modifier.target.types ?? []),
              ...(leader.passive.deploy === undefined ? [] : [leader.passive.deploy.unit]),
              ...(leader.unlock.kind === 'unitsOnBoard' ? [leader.unlock.unit] : []),
            ]
          : unitsIn(leader.action);
      if (leader.kind !== 'commander') expect(leader.action.length).toBeGreaterThan(0);
      for (const unit of units) expect(unitIds.has(unit)).toBe(true);
    }
  });

  it('der Content-Adapter liefert die Anführer', () => {
    expect(createBaseContent().leaders).toBe(LEADERS);
  });
});
