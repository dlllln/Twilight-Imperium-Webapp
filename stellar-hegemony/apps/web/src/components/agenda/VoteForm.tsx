import { type GameState, type PlanetId, type PlayerId, votingPower } from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { planetLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { Actions } from '../game/FormParts.tsx';
import { outcomeLabel } from './outcome-label.ts';

const toggled = (list: readonly PlanetId[], id: PlanetId) =>
  list.includes(id) ? list.filter((other) => other !== id) : [...list, id];

function OutcomeSelect(props: {
  readonly game: GameState;
  readonly outcomes: readonly string[];
  readonly value: string;
  readonly onChange: (outcome: string) => void;
}): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <label>
      {t('voteFor')}
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.outcomes.map((outcome) => (
          <option key={outcome} value={outcome}>
            {outcomeLabel(props.game, outcome, language, t)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlanetVotes(props: {
  readonly planets: readonly { readonly id: PlanetId; readonly influence: number }[];
  readonly chosen: readonly PlanetId[];
  readonly onToggle: (id: PlanetId) => void;
}): ReactElement {
  const language = useLanguage();
  return (
    <div className="vote-planets">
      {props.planets.map((planet) => (
        <label key={planet.id}>
          <input
            type="checkbox"
            checked={props.chosen.includes(planet.id)}
            onChange={() => props.onToggle(planet.id)}
          />
          {planetLabel(planet.id, language)} <span className="influence">{planet.influence}</span>
        </label>
      ))}
    </div>
  );
}

interface VoteProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly outcomes: readonly string[];
}

/** Gewähltes Ergebnis, erschöpfte Planeten und die Summe einschließlich Gesetzesstimmen. */
function useVote({ game, player, outcomes }: VoteProps) {
  const [outcome, setOutcome] = useState(outcomes[0] ?? '');
  const [planets, setPlanets] = useState<readonly PlanetId[]>([]);
  const power = votingPower(game, player, content);
  const chosen = power.planets.filter((planet) => planets.includes(planet.id));
  const total = chosen.reduce((sum, planet) => sum + planet.influence, power.bonus);
  const toggle = (id: PlanetId) => setPlanets((current) => toggled(current, id));
  return { outcome, setOutcome, planets, toggle, power, total };
}

function VoteTotal({ bonus, total }: { readonly bonus: number; readonly total: number }) {
  const t = useT();
  return (
    <>
      {bonus > 0 && (
        <p className="hint">
          {t('lawBonusVotes')}: +{bonus}
        </p>
      )}
      <p>
        {t('votesOf')}: <strong data-testid="vote-total">{total}</strong>
      </p>
    </>
  );
}

/** RR 2.6: Planeten erschöpfen und alle Stimmen für ein Ergebnis abgeben, oder enthalten. */
export function VoteForm(props: VoteProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const { outcome, setOutcome, planets, toggle, power, total } = useVote(props);
  const { game, player } = props;
  return (
    <div className="turn-block vote-form">
      <OutcomeSelect game={game} outcomes={props.outcomes} value={outcome} onChange={setOutcome} />
      <p className="hint">{t('voteHint')}</p>
      <PlanetVotes planets={power.planets} chosen={planets} onToggle={toggle} />
      <VoteTotal bonus={power.bonus} total={total} />
      <Actions
        label={t('castVotes')}
        disabled={total === 0}
        onClick={() => send({ type: 'CastVotes', issuedBy: player, outcome, planets })}
      >
        <button type="button" onClick={() => send({ type: 'Abstain', issuedBy: player })}>
          {t('abstain')}
        </button>
      </Actions>
    </div>
  );
}
