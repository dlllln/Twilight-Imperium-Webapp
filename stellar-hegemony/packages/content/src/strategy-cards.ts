import { strategyCardId, type StrategyCardDefinition } from '@stellar/domain';
import type { LocalizedText } from './localized.ts';

/** Eigene Namen und Texte; Initiative und Zahlenwerte folgen der Spielmechanik. */
export interface StrategyCardText {
  readonly name: LocalizedText;
  readonly primary: LocalizedText;
  readonly secondary: LocalizedText;
}

const card = (
  id: string,
  initiative: number,
  mechanic: StrategyCardDefinition['mechanic'],
  parameters: Record<string, number> = {},
  secondaryCostsStrategyToken = true,
): StrategyCardDefinition => ({
  id: strategyCardId(id),
  initiative,
  mechanic,
  secondaryCostsStrategyToken,
  parameters,
});

export const STRATEGY_CARDS: readonly StrategyCardDefinition[] = [
  card('vanguard', 1, 'commandTokens', { tokensGained: 3, influencePerToken: 3 }, false),
  card('embassy', 2, 'diplomacy', { readyPlanets: 2 }),
  card('senate', 3, 'politics'),
  card('engineering', 4, 'construction', { structures: 2 }),
  card('exchange', 5, 'trade', { tradeGoods: 3 }),
  card('armament', 6, 'warfare'),
  card('research', 7, 'technology', { extraResearchCost: 6, secondaryResearchCost: 4 }),
  card('crown', 8, 'imperial', { throneVictoryPoints: 1 }),
];

export const STRATEGY_CARD_TEXTS: Readonly<Record<string, StrategyCardText>> = {
  vanguard: {
    name: { de: 'Vorhut', en: 'Vanguard' },
    primary: {
      de: 'Erhalte 3 Kommandomarker. Für je 3 ausgegebenen Einfluss erhältst du 1 weiteren.',
      en: 'Gain 3 command tokens. Gain 1 more for every 3 influence you spend.',
    },
    secondary: {
      de: 'Für je 3 ausgegebenen Einfluss erhältst du 1 Kommandomarker. Kostet keinen Strategiemarker.',
      en: 'Gain 1 command token for every 3 influence you spend. Costs no strategy token.',
    },
  },
  embassy: {
    name: { de: 'Gesandtschaft', en: 'Embassy' },
    primary: {
      de: 'Wähle ein System, in dem dir ein Planet gehört (nicht das Thronwelt-System). Mache deine erschöpften Planeten dort bereit. Jeder andere Spieler legt dort einen Kommandomarker ab.',
      en: 'Choose a system where you control a planet (not the throne world system). Ready your exhausted planets there. Every other player places a command token there.',
    },
    secondary: {
      de: 'Gib 1 Strategiemarker aus, um bis zu 2 deiner erschöpften Planeten bereitzumachen.',
      en: 'Spend 1 strategy token to ready up to 2 of your exhausted planets.',
    },
  },
  senate: {
    name: { de: 'Senat', en: 'Senate' },
    primary: {
      de: 'Bestimme einen neuen Sprecher, ziehe 2 Aktionskarten und sieh dir die obersten 2 Agenden an.',
      en: 'Choose a new speaker, draw 2 action cards and look at the top 2 agendas.',
    },
    secondary: { de: 'Ziehe 2 Aktionskarten.', en: 'Draw 2 action cards.' },
  },
  engineering: {
    name: { de: 'Baukunst', en: 'Engineering' },
    primary: {
      de: 'Errichte ein Orbitalgeschütz oder Raumdock auf einem deiner Planeten, danach ein weiteres Orbitalgeschütz.',
      en: 'Build an orbital battery or dock on one of your planets, then another orbital battery.',
    },
    secondary: {
      de: 'Lege einen Marker aus dem Nachschub in ein System und errichte dort ein Gebäude.',
      en: 'Place a token from your reinforcements in a system and build a structure there.',
    },
  },
  exchange: {
    name: { de: 'Kontor', en: 'Exchange' },
    primary: {
      de: 'Erhalte 3 Handelswaren, fülle deine Rohstoffe auf und erlaube anderen das Auffüllen ohne Kosten.',
      en: 'Gain 3 trade goods, refill your commodities and let others refill for free.',
    },
    secondary: { de: 'Fülle deine Rohstoffe auf.', en: 'Refill your commodities.' },
  },
  armament: {
    name: { de: 'Rüstung', en: 'Armament' },
    primary: {
      de: 'Nimm einen deiner Marker vom Spielplan zurück und verteile deine Marker neu.',
      en: 'Take back one of your tokens from the board and redistribute your tokens.',
    },
    secondary: { de: 'Produziere in deinem Heimatsystem.', en: 'Produce in your home system.' },
  },
  research: {
    name: { de: 'Forschung', en: 'Research' },
    primary: {
      de: 'Erforsche 1 Technologie und danach eine weitere gegen Ressourcen.',
      en: 'Research 1 technology, then another for resources.',
    },
    secondary: {
      de: 'Erforsche 1 Technologie gegen Ressourcen.',
      en: 'Research 1 technology for resources.',
    },
  },
  crown: {
    name: { de: 'Krone', en: 'Crown' },
    primary: {
      de: 'Werte sofort ein öffentliches Ziel. Kontrollierst du die Thronwelt, erhältst du 1 Siegpunkt, sonst ein geheimes Ziel.',
      en: 'Score a public objective now. Gain 1 victory point if you control the throne world, otherwise draw a secret objective.',
    },
    secondary: { de: 'Ziehe 1 geheimes Ziel.', en: 'Draw 1 secret objective.' },
  },
};
