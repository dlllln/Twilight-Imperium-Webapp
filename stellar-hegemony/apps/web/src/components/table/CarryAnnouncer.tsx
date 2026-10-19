import type { GameState } from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { type Language, translate } from '../../i18n.ts';
import { useCarryFocus } from '../../table/carry-focus.ts';
import { type CarryNews, useCarryEscape, useCarryStore } from '../../table/carry-store.ts';
import { pieceLabel, targetLabel } from '../../table/target-ref.ts';
import { PLACE_HERE_ID } from '../../table/use-target.ts';
import { useLanguage } from '../../use-translation.ts';

/*
 * Live-Ansage für Bildschirmleser: nennt das Aufnehmen, das Ablegen und das Zurücklegen eines
 * Stücks, nicht aber jede Bewegung des Zeigers. Escape legt das getragene Stück zurück; wer per
 * Tastatur trägt, dessen Fokus wandert mit. Erlaubte Ziele beschreibt der Satz „Hierher legen“.
 */

function announcement(news: CarryNews, game: GameState, language: Language): string {
  if (news.kind === 'carried') {
    const piece = pieceLabel(news.ref, game, language);
    return translate(language, 'carried').replace('{piece}', piece);
  }
  const name = targetLabel(news.ref, game, language);
  if (news.kind === 'placed') return translate(language, 'placed').replace('{target}', name);
  return translate(language, 'putBack');
}

export function CarryAnnouncer({ game }: { readonly game: GameState }): ReactElement {
  useCarryEscape();
  const language = useLanguage();
  const news = useCarryStore((state) => state.news);
  // Meldungen von vor dem Erscheinen sind alt und werden nicht noch einmal angesagt.
  const [seen] = useState(() => news?.serial ?? 0);
  useCarryFocus(news, seen);
  const text = news === null || news.serial <= seen ? '' : announcement(news, game, language);
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {text}
      </p>
      <span id={PLACE_HERE_ID} hidden>
        {translate(language, 'placeHere')}
      </span>
    </>
  );
}
