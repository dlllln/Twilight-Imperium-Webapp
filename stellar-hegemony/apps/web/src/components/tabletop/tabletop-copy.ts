import type { Language } from '../../i18n.ts';
import type { TabletopItem, TabletopKind, TabletopPile } from './tabletop-model.ts';

const PILES = {
  action: ['Aktion', 'Action'],
  agenda: ['Agenda', 'Agenda'],
  secret: ['Geheim', 'Secret'],
  relic: ['Relikt', 'Relic'],
  discard: ['Ablage', 'Discard'],
} as const;

const ITEMS: Readonly<Record<TabletopItem, readonly [string, string]>> = {
  action: ['Aktionskarten', 'action cards'],
  secret: ['Geheimaufträge', 'secret objectives'],
  relic: ['Relikte', 'relics'],
  strategy: ['Strategiekarten', 'strategy cards'],
  goods: ['Handelswaren', 'trade goods'],
  planet: ['Planeten', 'planets'],
  leader: ['Anführer', 'leaders'],
  agenda: ['Agenden', 'agendas'],
  exploration: ['Erkundungskarten', 'exploration cards'],
};

const MOVES: Readonly<Record<TabletopKind, readonly [string, string]>> = {
  draw: ['zieht', 'draws'],
  play: ['spielt', 'plays'],
  discard: ['legt ab', 'discards'],
  spend: ['bezahlt', 'spends'],
  gain: ['erhält', 'gains'],
  exhaust: ['erschöpft', 'exhausts'],
  purge: ['entfernt aus dem Spiel', 'purges'],
};

export const pileLabel = (id: TabletopPile['id'], language: Language): string =>
  PILES[id][language === 'de' ? 0 : 1];
export const itemLabel = (id: TabletopItem, language: Language): string =>
  ITEMS[id][language === 'de' ? 0 : 1];
export const moveLabel = (id: TabletopKind, language: Language): string =>
  MOVES[id][language === 'de' ? 0 : 1];
