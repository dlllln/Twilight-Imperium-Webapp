import type { GameState } from '@stellar/domain';
import type { ReactElement } from 'react';
import type { CombatLogEvent } from '../../combat-view.ts';
import { planetLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { VolleyDice } from './VolleyDice.tsx';

type Of<T extends CombatLogEvent['type']> = Extract<CombatLogEvent, { type: T }>;

interface EntryProps<E> {
  readonly game: GameState;
  readonly event: E;
}

export function Bombardment({ game, event }: EntryProps<Of<'BombardmentRolled'>>): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <>
      <h4>
        {t('bombardment')}: {planetLabel(event.planet, language)}
      </h4>
      <VolleyDice game={game} volley={event.volley} />
      <p>
        {t('destroyedLabel')}: {event.destroyed.length}
      </p>
    </>
  );
}

export function Landing({ game, event }: EntryProps<Of<'GroundForcesCommitted'>>): ReactElement {
  const t = useT();
  const language = useLanguage();
  const planets = [...new Set(event.landings.map((landing) => landing.planet))];
  return (
    <h4>
      <PlayerTag game={game} id={event.player} /> {t('landsOn')}{' '}
      {planets.map((planet) => planetLabel(planet, language)).join(', ')} ({event.landings.length})
    </h4>
  );
}

export function DefenseFire({
  game,
  event,
}: EntryProps<Of<'SpaceCannonDefenseFired'>>): ReactElement {
  const t = useT();
  return (
    <>
      <h4>{t('defenseFire')}</h4>
      <VolleyDice game={game} volley={event.volley} />
      <p>
        {t('destroyedLabel')}: {event.destroyed.length}
      </p>
    </>
  );
}

export function GroundRound({
  game,
  event,
}: EntryProps<Of<'GroundCombatRoundRolled'>>): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <>
      <h4>
        {t('groundCombat')} {planetLabel(event.planet, language)} · {t('round')} {event.round}
      </h4>
      {event.volleys.map((volley) => (
        <VolleyDice key={volley.player} game={game} volley={volley} />
      ))}
      <p>
        {t('sustainedLabel')}: {event.sustained.length} · {t('destroyedLabel')}:{' '}
        {event.destroyed.length}
      </p>
    </>
  );
}

export function GroundEnded({ game, event }: EntryProps<Of<'GroundCombatEnded'>>): ReactElement {
  const t = useT();
  if (event.winner === null) return <p className="combat-result">{t('noGroundSurvivors')}</p>;
  return (
    <p className="combat-result">
      {t('groundWinner')}: <PlayerTag game={game} id={event.winner} />
    </p>
  );
}

export function ControlGained({
  game,
  event,
}: EntryProps<Of<'PlanetControlGained'>>): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <p className="combat-result">
      <PlayerTag game={game} id={event.player} /> {t('takesControl')}{' '}
      {planetLabel(event.planet, language)}
      {event.structuresDestroyed.length > 0 &&
        ` · ${t('structuresDestroyed')}: ${String(event.structuresDestroyed.length)}`}
    </p>
  );
}

export function CenterToken({ game, event }: EntryProps<Of<'CenterTokenRemoved'>>): ReactElement {
  const t = useT();
  return (
    <p className="combat-result">
      <PlayerTag game={game} id={event.player} /> {t('centerTaken')} (+{event.victoryPoints})
    </p>
  );
}
