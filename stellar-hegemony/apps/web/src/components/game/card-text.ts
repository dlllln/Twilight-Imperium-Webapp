import { STRATEGY_CARD_TEXTS, type StrategyCardText } from '@stellar/content';

const FALLBACK: StrategyCardText = {
  name: { de: '?', en: '?' },
  primary: { de: '', en: '' },
  secondary: { de: '', en: '' },
};

export const cardText = (id: string): StrategyCardText => STRATEGY_CARD_TEXTS[id] ?? FALLBACK;
