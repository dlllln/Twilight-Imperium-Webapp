import type { GameState, StrategyCardState } from '@stellar/domain';
import { Crosshair, Flag } from 'lucide-react';
import type { ReactElement } from 'react';
import type { HandEntry } from '../../hand/hand-model.ts';
import type { MessageKey } from '../../i18n.ts';
import { actionCardLabel } from '../../labels.ts';
import { systemLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { CardFace } from '../cards/CardItem.tsx';
import { cardText } from '../game/card-text.ts';

/** Strategiekarte: große Initiative, Name, Hauptfähigkeit; liegen gebliebene Waren als Bonus. */
function StrategyFace({
  card,
  label,
}: {
  readonly card: StrategyCardState;
  readonly label: MessageKey | null;
}): ReactElement {
  const t = useT();
  const language = useLanguage();
  const text = cardText(card.id);
  return (
    <>
      <span className="hand-initiative">{card.initiative}</span>
      {label !== null && <span className="hand-kicker">{t(label)}</span>}
      <strong className="hand-title">{text.name[language]}</strong>
      <span className="hand-text">{text.primary[language]}</span>
      {card.tradeGoods > 0 && <span className="hand-goods">+{card.tradeGoods}</span>}
    </>
  );
}

function TacticalFace({
  game,
  system,
}: {
  readonly game: GameState;
  readonly system: string | null;
}) {
  const t = useT();
  const language = useLanguage();
  return (
    <>
      <Crosshair className="hand-icon" size={34} aria-hidden="true" />
      <strong className="hand-title">{t('tacticalAction')}</strong>
      <span className="hand-text">
        {system === null
          ? t('pickSystemOnMap')
          : `${t('selectedSystem')}: ${systemLabel(game, system, language)}`}
      </span>
    </>
  );
}

function PassFace({ playable }: { readonly playable: boolean }): ReactElement {
  const t = useT();
  return (
    <>
      <Flag className="hand-icon" size={34} aria-hidden="true" />
      <strong className="hand-title">{t('pass')}</strong>
      <span className="hand-text">{t(playable ? 'passNow' : 'passLater')}</span>
    </>
  );
}

/** Die Vorderseite einer Handkarte je nach Art. */
export function HandFace({
  game,
  entry,
}: {
  readonly game: GameState;
  readonly entry: HandEntry;
}): ReactElement {
  switch (entry.kind) {
    case 'pick':
      return <StrategyFace card={entry.card} label={null} />;
    case 'strategic':
      return <StrategyFace card={entry.card} label="strategicAction" />;
    case 'tactical':
      return <TacticalFace game={game} system={entry.system} />;
    case 'pass':
      return <PassFace playable={entry.playable} />;
    case 'action':
      return <CardFace id={entry.card.definition.id} count={entry.card.count} />;
  }
}

/** Name der Karte für Screenreader und Tests, z. B. „Strategische Aktion: Führung“. */
export function useEntryName(): (entry: HandEntry) => string {
  const t = useT();
  const language = useLanguage();
  return (entry) => {
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
