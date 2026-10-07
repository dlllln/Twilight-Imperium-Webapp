import type { StrategyMechanic } from './strategy-card.ts';
import { commandTokensEffect } from './command-tokens-effect.ts';
import { constructionEffect } from './construction-effect.ts';
import { diplomacyEffect } from './diplomacy-effect.ts';
import { imperialEffect } from './imperial-effect.ts';
import { politicsEffect } from './politics-effect.ts';
import { technologyEffect } from './technology-effect.ts';
import { tradeEffect } from './trade-effect.ts';
import { warfareEffect } from './warfare-effect.ts';
import type { StrategyEffect } from './strategy-effect.ts';

/** Registrierte Mechaniken (Open/Closed): eine neue Karte ist ein neuer Eintrag. */
const EFFECTS: Partial<Record<StrategyMechanic, StrategyEffect>> = {
  commandTokens: commandTokensEffect,
  diplomacy: diplomacyEffect,
  construction: constructionEffect,
  trade: tradeEffect,
  warfare: warfareEffect,
  technology: technologyEffect,
  imperial: imperialEffect,
  politics: politicsEffect,
};

export const strategyEffectFor = (mechanic: StrategyMechanic): StrategyEffect | undefined =>
  EFFECTS[mechanic];
