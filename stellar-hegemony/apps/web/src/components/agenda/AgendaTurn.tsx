import { currentAgenda, type GameState, type PlayerId } from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { Actions } from '../game/FormParts.tsx';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { AgendaCard } from './AgendaCard.tsx';
import { outcomeLabel } from './outcome-label.ts';
import { VoteForm } from './VoteForm.tsx';

interface TurnProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

/** RR 2.19: bei Gleichstand wählt der Sprecher eines der gleichauf liegenden Ergebnisse. */
function TieBreakForm({ game, player, tied }: TurnProps & { readonly tied: readonly string[] }) {
  const t = useT();
  const language = useLanguage();
  const send = useGameStore((state) => state.send);
  const [outcome, setOutcome] = useState(tied[0] ?? '');
  return (
    <div className="turn-block tie-break">
      <h3>{t('tieBreak')}</h3>
      <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
        {tied.map((option) => (
          <option key={option} value={option}>
            {outcomeLabel(game, option, language, t)}
          </option>
        ))}
      </select>
      <Actions
        label={t('decide')}
        onClick={() => send({ type: 'BreakTie', issuedBy: player, outcome })}
      />
    </div>
  );
}

/** Agendaphase im Hot-Seat: offene Agenda, dann Stimmabgabe oder Stichentscheid. */
export function AgendaTurn({ game, player }: TurnProps): ReactElement | null {
  const t = useT();
  const view = currentAgenda(game, content);
  const phase = game.agendaPhase;
  if (view === null || phase === null) return null;
  const key = `${player}-${String(phase.number)}`;
  return (
    <>
      <AgendaCard game={game} view={view} number={phase.number} />
      <p className="decider">
        <PlayerTag game={game} id={player} /> {t('decides')}
      </p>
      {phase.tied === null ? (
        <VoteForm key={key} game={game} player={player} outcomes={view.outcomes} />
      ) : (
        <TieBreakForm key={key} game={game} player={player} tied={phase.tied} />
      )}
    </>
  );
}
