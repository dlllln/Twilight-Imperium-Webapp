import type { GameState, StrategyCardState } from '@stellar/domain';
import type { ReactElement, ReactNode } from 'react';
import { lookOf } from '../../hand/card-look.ts';
import { entryKey, type HandEntry, isTable, type TableEntry } from '../../hand/hand-model.ts';
import type { Language, MessageKey } from '../../i18n.ts';
import {
  actionCardEffect,
  actionCardLabel,
  actionCardTiming,
  deckLabel,
  legendaryEffect,
  legendaryLabel,
  planetLabel,
  relicEffect,
  relicLabel,
  systemLabel,
} from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { cardText } from '../game/card-text.ts';
import { CardArt, CardFrame } from './CardArt.tsx';

/** Was auf einer Karte steht: Überschrift, Name, Text und Zeichen im Bildfenster. */
interface Face {
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
  readonly marks: ReactNode;
}

type Translate = (key: MessageKey) => string;

function StrategyMarks({ card }: { readonly card: StrategyCardState }): ReactElement {
  return (
    <>
      <span className="hand-initiative">{card.initiative}</span>
      {card.tradeGoods > 0 && <span className="hand-goods">+{card.tradeGoods}</span>}
    </>
  );
}

const strategyFace = (card: StrategyCardState, kicker: string, language: Language): Face => ({
  kicker,
  title: cardText(card.id).name[language],
  text: cardText(card.id).primary[language],
  marks: <StrategyMarks card={card} />,
});

/** Aktionskarte: der Zeitpunkt steht vor der Wirkung, wie auf einer gedruckten Karte. */
function actionFace(
  entry: Extract<HandEntry, { kind: 'action' }>,
  t: Translate,
  language: Language,
): Face {
  const id = entry.card.definition.id;
  const count = entry.card.count;
  return {
    kicker: t('actionCardKind'),
    title: actionCardLabel(id, language),
    text: `${actionCardTiming(id, language)}: ${actionCardEffect(id, language)}`,
    marks: count > 1 && <span className="hand-count">×{count}</span>,
  };
}

function tacticalText(game: GameState, system: string | null, t: Translate, language: Language) {
  if (system === null) return t('pickSystemOnMap');
  return `${t('selectedSystem')}: ${systemLabel(game, system, language)}`;
}

/** Kleines Schild auf der Karte, z. B. „erschöpft“ oder „×2“. */
const stamp = (text: string) => <span className="hand-count">{text}</span>;

/** Name einer PoK-Karte vor dem Spieler. */
function tableTitle(entry: TableEntry, t: Translate, language: Language): string {
  switch (entry.kind) {
    case 'relic':
      return relicLabel(entry.relic.id, language);
    case 'fragment':
      return `${t('fragmentKind')}: ${deckLabel(entry.fragment, language)}`;
    case 'legendary':
      return legendaryLabel(entry.planet, language);
  }
}

function fragmentText(entry: Extract<TableEntry, { kind: 'fragment' }>, t: Translate): string {
  if (entry.playable) return t('purgeNow');
  return t(entry.purge === null ? 'fragmentHint' : 'purgeLater');
}

/** Relikt, Reliktfragment oder legendärer Planet als Karte. */
function tableFace(entry: TableEntry, t: Translate, language: Language): Face {
  const title = tableTitle(entry, t, language);
  switch (entry.kind) {
    case 'relic':
      return {
        kicker: t('relicKind'),
        title,
        text: relicEffect(entry.relic.id, language),
        marks: entry.relic.exhausted && stamp(t('exhausted')),
      };
    case 'fragment':
      return {
        kicker: t('fragmentKind'),
        title: deckLabel(entry.fragment, language),
        text: fragmentText(entry, t),
        marks: entry.count > 1 && stamp(`×${String(entry.count)}`),
      };
    case 'legendary':
      return {
        kicker: `${t('legendaryKind')} · ${planetLabel(entry.planet, language)}`,
        title,
        text: legendaryEffect(entry.planet, language),
        marks: entry.used && stamp(t('usedThisRound')),
      };
  }
}

/** Inhalt einer Karte je nach Art. */
function faceOf(game: GameState, entry: HandEntry, t: Translate, language: Language): Face {
  if (isTable(entry)) return tableFace(entry, t, language);
  const turn = { kicker: t('turnCardKind'), marks: null };
  switch (entry.kind) {
    case 'pick':
      return strategyFace(entry.card, t('strategyCardKind'), language);
    case 'strategic':
      return strategyFace(entry.card, t('strategicAction'), language);
    case 'tactical':
      return {
        ...turn,
        title: t('tacticalAction'),
        text: tacticalText(game, entry.system, t, language),
      };
    case 'pass':
      return { ...turn, title: t('pass'), text: t(entry.playable ? 'passNow' : 'passLater') };
    case 'action':
      return actionFace(entry, t, language);
  }
}

/** Die Vorderseite einer Handkarte: Zierrahmen, Bildfenster mit Motiv, Name und Text. */
export function HandFace({
  game,
  entry,
}: {
  readonly game: GameState;
  readonly entry: HandEntry;
}): ReactElement {
  const t = useT();
  const language = useLanguage();
  const face = faceOf(game, entry, t, language);
  return (
    <>
      <CardFrame />
      <CardArt look={lookOf(entry)} seed={entryKey(entry)} />
      {face.marks}
      <span className="hand-kicker">{face.kicker}</span>
      <strong className="hand-title">{face.title}</strong>
      <span className="hand-rule" aria-hidden="true" />
      <span className="hand-text">{face.text}</span>
    </>
  );
}

/** Name der Karte für Screenreader und Tests, z. B. „Strategische Aktion: Führung“. */
export function useEntryName(): (entry: HandEntry) => string {
  const t = useT();
  const language = useLanguage();
  return (entry) => {
    if (isTable(entry)) return tableTitle(entry, t, language);
    switch (entry.kind) {
      case 'pick':
        return cardText(entry.card.id).name[language];
      case 'strategic':
        return `${t('strategicAction')}: ${cardText(entry.card.id).name[language]}`;
      case 'tactical':
        return `${t('tacticalAction')} · ${t('activateSystem')}`;
      case 'pass':
        return t('pass');
      case 'action':
        return actionCardLabel(entry.card.definition.id, language);
    }
  };
}
