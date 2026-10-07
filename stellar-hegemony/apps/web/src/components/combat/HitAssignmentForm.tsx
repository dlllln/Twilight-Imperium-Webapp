import {
  absorbableHits,
  canSustainDamage,
  type GameState,
  type HitAssignment,
  type PlayerId,
  type Unit,
  type UnitId,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { unitsOf } from '../../unit-stats.ts';
import { useT } from '../../use-translation.ts';
import { UnitFigure } from './UnitFigure.tsx';

type Choice = 'none' | 'sustain' | 'destroy';
type Choices = Readonly<Record<UnitId, Choice>>;

const initialChoices = (units: readonly Unit[], suggestion: HitAssignment): Choices =>
  Object.fromEntries(
    units.map((unit) => {
      if (suggestion.sustained.includes(unit.id)) return [unit.id, 'sustain'];
      return [unit.id, suggestion.destroyed.includes(unit.id) ? 'destroy' : 'none'];
    }),
  );

const sustainable = (game: GameState, unit: Unit): boolean => {
  const definition = unitsOf(game).find(unit.type, unit.owner);
  return !unit.damaged && definition !== undefined && canSustainDamage(definition);
};

const idsWith = (choices: Choices, choice: Choice): UnitId[] =>
  Object.entries(choices).flatMap(([id, value]) => (value === choice ? [id as UnitId] : []));

interface HitProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly hits: number;
  readonly units: readonly Unit[];
  readonly suggestion: HitAssignment;
}

function UnitChoice({
  game,
  unit,
  choice,
  onChange,
}: {
  readonly game: GameState;
  readonly unit: Unit;
  readonly choice: Choice;
  readonly onChange: (choice: Choice) => void;
}): ReactElement {
  const t = useT();
  return (
    <li className={`hit-choice ${choice}`}>
      <UnitFigure game={game} unit={unit} />
      <select
        value={choice}
        aria-label={t('assignHits')}
        onChange={(event) => onChange(event.target.value as Choice)}
      >
        <option value="none">{t('noHit')}</option>
        {sustainable(game, unit) && <option value="sustain">{t('sustain')}</option>}
        <option value="destroy">{t('destroy')}</option>
      </select>
    </li>
  );
}

function useChoices(units: readonly Unit[], suggestion: HitAssignment) {
  const [choices, setChoices] = useState(() => initialChoices(units, suggestion));
  const choose = (unit: UnitId, choice: Choice) =>
    setChoices((current) => ({ ...current, [unit]: choice }));
  return {
    choices,
    choose,
    sustained: idsWith(choices, 'sustain'),
    destroyed: idsWith(choices, 'destroy'),
  };
}

type ChoicesApi = ReturnType<typeof useChoices>;

function HitChoices({
  game,
  units,
  api,
}: {
  readonly game: GameState;
  readonly units: readonly Unit[];
  readonly api: ChoicesApi;
}): ReactElement {
  return (
    <ul className="hit-choices">
      {units.map((unit) => (
        <UnitChoice
          key={unit.id}
          game={game}
          unit={unit}
          choice={api.choices[unit.id] ?? 'none'}
          onChange={(choice) => api.choose(unit.id, choice)}
        />
      ))}
    </ul>
  );
}

/** RR 89.1/66: Treffer auf eigene Schiffe verteilen, vorbelegt mit einem sinnvollen Vorschlag. */
export function HitAssignmentForm({
  game,
  player,
  hits,
  units,
  suggestion,
}: HitProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const api = useChoices(units, suggestion);
  const { sustained, destroyed } = api;
  const confirm = () => send({ type: 'AssignHits', issuedBy: player, sustained, destroyed });
  const required = Math.min(hits, absorbableHits(units, unitsOf(game)));
  const assigned = sustained.length + destroyed.length;
  return (
    <div className="combat-decision">
      <h3>
        {t('assignHits')}: {hits}
      </h3>
      <p className="hint">{t('assignHitsHint')}</p>
      <HitChoices game={game} units={units} api={api} />
      <button type="button" className="primary" disabled={assigned !== required} onClick={confirm}>
        {t('confirmHits')} ({assigned}/{required})
      </button>
    </div>
  );
}
