import type { StrategyMechanic } from './strategy-card.ts';
import { commandTokensEffect } from './command-tokens-effect.ts';
import { diplomacyEffect } from './diplomacy-effect.ts';
import type { StrategyEffect } from './strategy-effect.ts';

/**
 * Registrierte Mechaniken (Open/Closed). Weitere Karten werden in ihren
 * Iterationen ergänzt: Bauen, Handel und Kriegsführung (6; Kriegsführung braucht
 * Produktion), Technologie (7), Imperium (8), Politik (10).
 */
const EFFECTS: Partial<Record<StrategyMechanic, StrategyEffect>> = {
  commandTokens: commandTokensEffect,
  diplomacy: diplomacyEffect,
};

export const strategyEffectFor = (mechanic: StrategyMechanic): StrategyEffect | undefined =>
  EFFECTS[mechanic];
