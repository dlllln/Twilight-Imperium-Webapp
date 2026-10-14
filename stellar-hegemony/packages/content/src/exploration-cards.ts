import {
  type ExplorationCardDefinition,
  explorationCardId,
  type ExplorationDeckKind,
  type ExplorationEffect,
} from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { UNIT_TYPES } from './units.ts';

/*
 * Eigene Erkundungsstapel (Erweiterung Schritt 2): je Planeteneigenschaft 11 Karten,
 * dazu 9 Grenzkarten für leere Systeme. Namen, Werte und Texte sind eigene Entwürfe.
 * Jede Karte wirkt ohne Wahl; Anlagen bleiben am Planeten, Fragmente beim Spieler.
 */
const card = (
  id: string,
  deck: ExplorationDeckKind,
  copies: number,
  effect: ExplorationEffect,
): ExplorationCardDefinition => ({ id: explorationCardId(id), deck, copies, effect });

const TWO = 2;
const THREE = 3;

const attach = (resources: number, influence: number): ExplorationEffect => ({
  kind: 'attachment',
  resources,
  influence,
});

const specialty = (
  color: 'biotic' | 'propulsion' | 'cybernetic' | 'warfare',
): ExplorationEffect => ({
  kind: 'attachment',
  resources: 0,
  influence: 0,
  specialty: color,
});

const FRAGMENT: ExplorationEffect = { kind: 'relicFragment' };

const CULTURAL: readonly ExplorationCardDefinition[] = [
  card('poets-archive', 'cultural', TWO, attach(0, TWO)),
  card('ancient-amphitheatre', 'cultural', 1, attach(1, 1)),
  card('pilgrim-caravan', 'cultural', TWO, { kind: 'gainTradeGoods', amount: TWO }),
  card('welcoming-envoys', 'cultural', 1, { kind: 'gainCommodities', amount: TWO }),
  card('whispering-murals', 'cultural', 1, { kind: 'drawActionCards', count: 1 }),
  card('volunteer-militia', 'cultural', 1, {
    kind: 'placeUnits',
    unit: UNIT_TYPES.infantry,
    count: 1,
  }),
  card('culture-shard', 'cultural', THREE, FRAGMENT),
];

const HAZARDOUS: readonly ExplorationCardDefinition[] = [
  card('rich-ore-veins', 'hazardous', TWO, attach(TWO, 0)),
  card('toxic-bloom-lab', 'hazardous', 1, specialty('biotic')),
  card('crashed-warship', 'hazardous', 1, specialty('warfare')),
  card('salvage-field', 'hazardous', 1, { kind: 'gainTradeGoods', amount: TWO }),
  card('dormant-war-machine', 'hazardous', 1, {
    kind: 'placeUnits',
    unit: UNIT_TYPES.mech,
    count: 1,
  }),
  card('hardened-survivors', 'hazardous', 1, {
    kind: 'placeUnits',
    unit: UNIT_TYPES.infantry,
    count: TWO,
  }),
  card('smugglers-hideout', 'hazardous', 1, { kind: 'drawActionCards', count: 1 }),
  card('hazard-shard', 'hazardous', THREE, FRAGMENT),
];

const INDUSTRIAL: readonly ExplorationCardDefinition[] = [
  card('automated-foundry', 'industrial', TWO, attach(1, 0)),
  card('orbital-relay', 'industrial', 1, specialty('cybernetic')),
  card('drive-test-site', 'industrial', 1, specialty('propulsion')),
  card('surplus-depot', 'industrial', 1, { kind: 'gainCommodities', amount: THREE }),
  card('freight-contract', 'industrial', 1, { kind: 'gainTradeGoods', amount: TWO }),
  card('plant-guard', 'industrial', 1, {
    kind: 'placeUnits',
    unit: UNIT_TYPES.infantry,
    count: TWO,
  }),
  card('industrial-espionage', 'industrial', 1, { kind: 'drawActionCards', count: 1 }),
  card('industry-shard', 'industrial', THREE, FRAGMENT),
];

const FRONTIER: readonly ExplorationCardDefinition[] = [
  card('derelict-depot', 'frontier', TWO, { kind: 'tradeGoodsCache', amount: THREE }),
  card('drifting-wreck', 'frontier', 1, { kind: 'gainTradeGoods', amount: TWO }),
  card('lost-courier', 'frontier', 1, { kind: 'drawActionCards', count: 1 }),
  card('nebula-harvest', 'frontier', 1, { kind: 'gainCommodities', amount: TWO }),
  card('old-beacon', 'frontier', 1, { kind: 'gainTradeGoods', amount: 1 }),
  card('star-shard', 'frontier', THREE, FRAGMENT),
];

export const EXPLORATION_CARDS: readonly ExplorationCardDefinition[] = [
  ...CULTURAL,
  ...HAZARDOUS,
  ...INDUSTRIAL,
  ...FRONTIER,
];

export interface ExplorationCardText {
  readonly name: LocalizedText;
  readonly effect: LocalizedText;
}

const text = (de: string, en: string, effectDe: string, effectEn: string) => ({
  name: { de, en },
  effect: { de: effectDe, en: effectEn },
});

const FRAGMENT_NOTE = {
  de: 'Behalte diese Karte offen. Drei Fragmente einer Art ergeben ein Relikt.',
  en: 'Keep this card face up. Three fragments of one kind yield a relic.',
};

export const EXPLORATION_CARD_TEXTS: Readonly<Record<string, ExplorationCardText>> = {
  'poets-archive': text(
    'Archiv der Dichter',
    "Poets' Archive",
    'Anlage: Dieser Planet hat 2 Einfluss mehr.',
    'Attachment: This planet has 2 more influence.',
  ),
  'ancient-amphitheatre': text(
    'Uraltes Amphitheater',
    'Ancient Amphitheatre',
    'Anlage: Dieser Planet hat 1 Ressource und 1 Einfluss mehr.',
    'Attachment: This planet has 1 more resource and 1 more influence.',
  ),
  'pilgrim-caravan': text(
    'Pilgerkarawane',
    'Pilgrim Caravan',
    'Erhalte 2 Handelswaren.',
    'Gain 2 trade goods.',
  ),
  'welcoming-envoys': text(
    'Willkommene Gesandte',
    'Welcoming Envoys',
    'Erhalte 2 Rohstoffe (höchstens bis zu deinem Limit).',
    'Gain 2 commodities (up to your limit).',
  ),
  'whispering-murals': text(
    'Flüsternde Wandbilder',
    'Whispering Murals',
    'Ziehe 1 Aktionskarte.',
    'Draw 1 action card.',
  ),
  'volunteer-militia': text(
    'Freiwillige Miliz',
    'Volunteer Militia',
    'Setze 1 Infanterie aus deiner Verstärkung auf diesen Planeten.',
    'Place 1 infantry from your reinforcements on this planet.',
  ),
  'culture-shard': text('Kulturscherbe', 'Culture Shard', FRAGMENT_NOTE.de, FRAGMENT_NOTE.en),
  'rich-ore-veins': text(
    'Reiche Erzadern',
    'Rich Ore Veins',
    'Anlage: Dieser Planet hat 2 Ressourcen mehr.',
    'Attachment: This planet has 2 more resources.',
  ),
  'toxic-bloom-lab': text(
    'Labor im Giftbiotop',
    'Toxic Bloom Lab',
    'Anlage: Dieser Planet hat die Spezialisierung Biotik, falls er noch keine hat.',
    'Attachment: This planet gains the biotic specialty if it has none.',
  ),
  'crashed-warship': text(
    'Abgestürztes Kriegsschiff',
    'Crashed Warship',
    'Anlage: Dieser Planet hat die Spezialisierung Kriegsführung, falls er noch keine hat.',
    'Attachment: This planet gains the warfare specialty if it has none.',
  ),
  'salvage-field': text(
    'Bergungsfeld',
    'Salvage Field',
    'Erhalte 2 Handelswaren.',
    'Gain 2 trade goods.',
  ),
  'dormant-war-machine': text(
    'Schlafende Kriegsmaschine',
    'Dormant War Machine',
    'Setze 1 Mech aus deiner Verstärkung auf diesen Planeten.',
    'Place 1 mech from your reinforcements on this planet.',
  ),
  'hardened-survivors': text(
    'Abgehärtete Überlebende',
    'Hardened Survivors',
    'Setze 2 Infanterie aus deiner Verstärkung auf diesen Planeten.',
    'Place 2 infantry from your reinforcements on this planet.',
  ),
  'smugglers-hideout': text(
    'Schmugglerversteck',
    "Smugglers' Hideout",
    'Ziehe 1 Aktionskarte.',
    'Draw 1 action card.',
  ),
  'hazard-shard': text('Gefahrenscherbe', 'Hazard Shard', FRAGMENT_NOTE.de, FRAGMENT_NOTE.en),
  'automated-foundry': text(
    'Automatische Gießerei',
    'Automated Foundry',
    'Anlage: Dieser Planet hat 1 Ressource mehr.',
    'Attachment: This planet has 1 more resource.',
  ),
  'orbital-relay': text(
    'Orbitales Relais',
    'Orbital Relay',
    'Anlage: Dieser Planet hat die Spezialisierung Kybernetik, falls er noch keine hat.',
    'Attachment: This planet gains the cybernetic specialty if it has none.',
  ),
  'drive-test-site': text(
    'Antriebsprüfstand',
    'Drive Test Site',
    'Anlage: Dieser Planet hat die Spezialisierung Antrieb, falls er noch keine hat.',
    'Attachment: This planet gains the propulsion specialty if it has none.',
  ),
  'surplus-depot': text(
    'Überschusslager',
    'Surplus Depot',
    'Erhalte 3 Rohstoffe (höchstens bis zu deinem Limit).',
    'Gain 3 commodities (up to your limit).',
  ),
  'freight-contract': text(
    'Frachtvertrag',
    'Freight Contract',
    'Erhalte 2 Handelswaren.',
    'Gain 2 trade goods.',
  ),
  'plant-guard': text(
    'Werkschutz',
    'Plant Guard',
    'Setze 2 Infanterie aus deiner Verstärkung auf diesen Planeten.',
    'Place 2 infantry from your reinforcements on this planet.',
  ),
  'industrial-espionage': text(
    'Werkspionage',
    'Industrial Espionage',
    'Ziehe 1 Aktionskarte.',
    'Draw 1 action card.',
  ),
  'industry-shard': text('Industriescherbe', 'Industry Shard', FRAGMENT_NOTE.de, FRAGMENT_NOTE.en),
  'derelict-depot': text(
    'Verlassenes Depot',
    'Derelict Depot',
    'Lege 3 Handelswaren in dieses System. Wer zuerst nach einer Bewegung eigene Schiffe hier hat, nimmt sie.',
    'Place 3 trade goods in this system. The first player to have ships here after a movement takes them.',
  ),
  'drifting-wreck': text(
    'Treibendes Wrack',
    'Drifting Wreck',
    'Erhalte 2 Handelswaren.',
    'Gain 2 trade goods.',
  ),
  'lost-courier': text(
    'Verlorener Kurier',
    'Lost Courier',
    'Ziehe 1 Aktionskarte.',
    'Draw 1 action card.',
  ),
  'nebula-harvest': text(
    'Nebelernte',
    'Nebula Harvest',
    'Erhalte 2 Rohstoffe (höchstens bis zu deinem Limit).',
    'Gain 2 commodities (up to your limit).',
  ),
  'old-beacon': text('Alte Bake', 'Old Beacon', 'Erhalte 1 Handelsware.', 'Gain 1 trade good.'),
  'star-shard': text(
    'Sternenscherbe',
    'Star Shard',
    'Grenzfragment: zählt als Fragment jeder Art. Behalte diese Karte offen.',
    'Frontier fragment: counts as a fragment of any kind. Keep this card face up.',
  ),
};

export const explorationCardText = (id: string): ExplorationCardText | undefined =>
  EXPLORATION_CARD_TEXTS[id];

/** Anzeigenamen der Stapel und Fragmentarten. */
export const EXPLORATION_DECK_NAMES: Readonly<Record<ExplorationDeckKind, LocalizedText>> = {
  cultural: { de: 'Kulturell', en: 'Cultural' },
  hazardous: { de: 'Gefährlich', en: 'Hazardous' },
  industrial: { de: 'Industriell', en: 'Industrial' },
  frontier: { de: 'Grenze', en: 'Frontier' },
};
