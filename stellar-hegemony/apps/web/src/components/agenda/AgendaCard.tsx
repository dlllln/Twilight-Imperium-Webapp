import type { AgendaView, GameState } from '@stellar/domain';
import type { ReactElement } from 'react';
import { agendaLabel, agendaPassedText, agendaRejectedText } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { outcomeLabel } from './outcome-label.ts';

/** Zwischenstand: Stimmen je Ergebnis, nur Ergebnisse mit Stimmen. */
function Tally({ game, view }: { readonly game: GameState; readonly view: AgendaView }) {
  const t = useT();
  const language = useLanguage();
  const counted = [...view.counts.entries()].filter(([, votes]) => votes > 0);
  if (counted.length === 0) return null;
  return (
    <ul className="agenda-tally" aria-label={t('votesOf')}>
      {counted.map(([outcome, votes]) => (
        <li key={outcome}>
          <span>{outcomeLabel(game, outcome, language, t)}</span>
          <strong data-testid={`tally-${outcome}`}>{votes}</strong>
        </li>
      ))}
    </ul>
  );
}

/** Die offene Agenda in eigenen Worten: Art, Wirkung bei Annahme und bei Ablehnung. */
export function AgendaCard(props: {
  readonly game: GameState;
  readonly view: AgendaView;
  readonly number: number;
}): ReactElement {
  const t = useT();
  const language = useLanguage();
  const { agenda } = props.view;
  const rejected = agenda.election.kind === 'forAgainst';
  return (
    <article className={`agenda-card ${agenda.kind}`}>
      <header>
        <span className="badge">{t('agendaNumber').replace('{n}', String(props.number))}</span>
        <span className="agenda-kind">{t(agenda.kind)}</span>
      </header>
      <h3>{agendaLabel(agenda.id, language)}</h3>
      <p>
        <em>{t('ifPassed')}:</em> {agendaPassedText(agenda.id, language)}
      </p>
      {rejected && (
        <p>
          <em>{t('ifRejected')}:</em> {agendaRejectedText(agenda.id, language)}
        </p>
      )}
      <Tally game={props.game} view={props.view} />
    </article>
  );
}
