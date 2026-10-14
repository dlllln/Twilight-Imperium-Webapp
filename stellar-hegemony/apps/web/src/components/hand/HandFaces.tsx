import type { GameState, StrategyCardState } from '@stellar/domain';
import type { ReactElement, ReactNode } from 'react';
import {
  actionFrame,
  fragmentFrame,
  legendaryFrame,
  relicFrame,
  strategyFrame,
  type CardArtworkSource,
} from '../../artwork/cards.ts';
import { type HandEntry, isTable, type TableEntry } from '../../hand/hand-model.ts';
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
import { CardArtwork } from '../cards/CardArtwork.tsx';
import { CardArt } from './CardArt.tsx';

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

function tableFrame(entry: TableEntry): CardArtworkSource {
  switch (entry.kind) {
    case 'relic':
      return relicFrame(entry.relic.id);
    case 'fragment':
      return fragmentFrame(entry.fragment);
    case 'legendary':
      return legendaryFrame(entry.planet);
  }
}

function frameOf(entry: HandEntry): CardArtworkSource {
  if (isTable(entry)) return tableFrame(entry);
  if (entry.kind === 'action') return actionFrame(entry.card.definition.id);
  if (entry.kind === 'pick' || entry.kind === 'strategic')
    return strategyFrame(entry.card.mechanic);
  return strategyFrame(entry.kind === 'tactical' ? 'warfare' : 'commandTokens');
}

/** Original scanned frame and emblem, with the app's own localized playable effects. */
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
      <CardArtwork artwork={frameOf(entry)} className="hand-print-frame" />
      <span className="hand-print-copy">
        <CardArt entry={entry} />
        {face.marks}
        <span className="hand-kicker">{face.kicker}</span>
        <strong className="hand-title">{face.title}</strong>
        <span className="hand-rule" aria-hidden="true" />
        <span className="hand-text">{face.text}</span>
      </span>
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
