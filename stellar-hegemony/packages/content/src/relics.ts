import { type RelicDefinition, type RelicEffect, relicId } from '@stellar/domain';
import type { LocalizedText } from './localized.ts';

/*
 * Eigener Reliktstapel (Erweiterung Schritt 2): acht Relikte mit einfachen Wirkungen.
 * Drei wirken beim Erhalt, zwei dauerhaft, drei als Komponentenaktion. Namen und Texte
 * sind eigene Entwürfe.
 */
const relic = (id: string, effect: RelicEffect): RelicDefinition => ({ id: relicId(id), effect });

const TWO = 2;

export const RELICS: readonly RelicDefinition[] = [
  relic('seal-of-the-first-empress', {
    kind: 'onGain',
    reward: { kind: 'gainVictoryPoints', amount: 1 },
  }),
  relic('command-core', { kind: 'onGain', reward: { kind: 'gainCommandTokens', amount: TWO } }),
  relic('archive-of-the-fallen', {
    kind: 'onGain',
    reward: { kind: 'drawActionCards', count: TWO },
  }),
  relic('wanderers-star-chart', { kind: 'passive', modifiers: [], fleetLimit: 1 }),
  relic('war-banner', {
    kind: 'passive',
    modifiers: [{ target: { category: 'groundForce' }, change: { hitOn: -1 } }],
    fleetLimit: 0,
  }),
  relic('seed-capsule', { kind: 'action', reward: { kind: 'readyPlanets' }, usage: 'purge' }),
  relic('trade-prism', {
    kind: 'action',
    reward: { kind: 'gainTradeGoods', amount: TWO },
    usage: 'exhaust',
  }),
  relic('mending-swarm', { kind: 'action', reward: { kind: 'repairUnits' }, usage: 'exhaust' }),
];

export interface RelicText {
  readonly name: LocalizedText;
  readonly effect: LocalizedText;
}

const text = (de: string, en: string, effectDe: string, effectEn: string): RelicText => ({
  name: { de, en },
  effect: { de: effectDe, en: effectEn },
});

export const RELIC_TEXTS: Readonly<Record<string, RelicText>> = {
  'seal-of-the-first-empress': text(
    'Siegel der ersten Kaiserin',
    'Seal of the First Empress',
    'Wenn du dieses Relikt erhältst: Erhalte 1 Siegpunkt.',
    'When you gain this relic: Gain 1 victory point.',
  ),
  'command-core': text(
    'Kommandokern',
    'Command Core',
    'Wenn du dieses Relikt erhältst: Lege 2 Kommandomarker aus deinem Nachschub in deinen Taktikpool.',
    'When you gain this relic: Place 2 command tokens from your reinforcements in your tactic pool.',
  ),
  'archive-of-the-fallen': text(
    'Archiv der Gefallenen',
    'Archive of the Fallen',
    'Wenn du dieses Relikt erhältst: Ziehe 2 Aktionskarten.',
    'When you gain this relic: Draw 2 action cards.',
  ),
  'wanderers-star-chart': text(
    'Sternkarte der Wanderer',
    "Wanderers' Star Chart",
    'Dein Flottenlimit ist um 1 höher.',
    'Your fleet limit is 1 higher.',
  ),
  'war-banner': text(
    'Banner der Eisenlegion',
    'Banner of the Iron Legion',
    'Deine Infanterie und Mechs treffen bei einem um 1 niedrigeren Wurf.',
    'Your infantry and mechs hit on a roll 1 lower.',
  ),
  'seed-capsule': text(
    'Keimkapsel von Varn',
    'Seed Capsule of Varn',
    'Aktion: Mache alle deine Planeten bereit. Danach ist das Relikt aus dem Spiel.',
    'Action: Ready all of your planets. Then remove this relic from the game.',
  ),
  'trade-prism': text(
    'Handelsprisma',
    'Trade Prism',
    'Aktion: Erschöpfe das Relikt und erhalte 2 Handelswaren. Es wird in der Statusphase bereit.',
    'Action: Exhaust this relic to gain 2 trade goods. It readies in the status phase.',
  ),
  'mending-swarm': text(
    'Flickschwarm',
    'Mending Swarm',
    'Aktion: Erschöpfe das Relikt und repariere alle deine beschädigten Einheiten.',
    'Action: Exhaust this relic to repair all of your damaged units.',
  ),
};

export const relicText = (id: string): RelicText | undefined => RELIC_TEXTS[id];
