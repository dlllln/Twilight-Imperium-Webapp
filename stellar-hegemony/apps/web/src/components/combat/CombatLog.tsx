import type { GameState } from '@stellar/domain';
import { type ReactElement, useEffect, useRef } from 'react';
import type { CombatLogEvent } from '../../combat-view.ts';
import { systemLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import {
  Bombardment,
  CenterToken,
  ControlGained,
  DefenseFire,
  GroundEnded,
  GroundRound,
  Landing,
} from './InvasionEntries.tsx';
import { BonusGranted, HitsCancelled } from './CardEntries.tsx';
import { VolleyDice } from './VolleyDice.tsx';

interface EntryProps<E extends CombatLogEvent = CombatLogEvent> {
  readonly game: GameState;
  readonly event: E;
}

type Of<T extends CombatLogEvent['type']> = Extract<CombatLogEvent, { type: T }>;

function Cannon({ game, event }: EntryProps<Of<'SpaceCannonFired'>>): ReactElement {
  const t = useT();
  return (
    <>
      <h4>{t('cannonVolley')}</h4>
      <VolleyDice game={game} volley={event.volley} />
    </>
  );
}

function Barrage({ game, event }: EntryProps<Of<'AntiFighterBarrageFired'>>): ReactElement {
  const t = useT();
  return (
    <>
      <h4>{t('barrageVolley')}</h4>
      <VolleyDice game={game} volley={event.volley} />
      <p>
        {event.destroyed.length} {t('fightersDestroyed')}
      </p>
    </>
  );
}

function Round({ game, event }: EntryProps<Of<'CombatRoundRolled'>>): ReactElement {
  const t = useT();
  return (
    <>
      <h4>
        {t('round')} {event.round}
      </h4>
      {event.volleys.map((volley) => (
        <VolleyDice key={volley.player} game={game} volley={volley} />
      ))}
    </>
  );
}

function Assigned({ game, event }: EntryProps<Of<'HitsAssigned'>>): ReactElement {
  const t = useT();
  return (
    <p>
      <PlayerTag game={game} id={event.player} /> {t('sustainedLabel')}: {event.sustained.length}
      {' · '}
      {t('destroyedLabel')}: {event.destroyed.length}
    </p>
  );
}

function Declared({ game, event }: EntryProps<Of<'RetreatDeclared'>>): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <p>
      <PlayerTag game={game} id={event.player} />{' '}
      {event.to === null
        ? t('keepsFighting')
        : `${t('announcesRetreat')} ${systemLabel(game, event.to, language)}`}
    </p>
  );
}

function Retreated({ game, event }: EntryProps<Of<'ShipsRetreated'>>): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <p>
      <PlayerTag game={game} id={event.player} /> {t('retreatedTo')}{' '}
      {systemLabel(game, event.to, language)}
    </p>
  );
}

function Ended({ game, event }: EntryProps<Of<'SpaceCombatEnded'>>): ReactElement {
  const t = useT();
  if (event.winner === null) return <p className="combat-result">{t('noSurvivors')}</p>;
  return (
    <p className="combat-result">
      {t('winner')}: <PlayerTag game={game} id={event.winner} />
    </p>
  );
}

function Simple({ event }: EntryProps): ReactElement {
  const t = useT();
  if (event.type === 'SpaceCombatStarted') return <h4>{t('combatBegins')}</h4>;
  const count = event.type === 'UnitsDestroyed' ? event.units.length : 0;
  return (
    <p>
      {t('cargoLost')}: {count}
    </p>
  );
}

type Renderers = {
  readonly [T in CombatLogEvent['type']]?: (props: EntryProps<Of<T>>) => ReactElement;
};

/** Ein Eintrag je Ereignis; jede Ereignisart hat ihre eigene kleine Darstellung. */
const RENDERERS: Renderers = {
  SpaceCannonFired: Cannon,
  AntiFighterBarrageFired: Barrage,
  CombatRoundRolled: Round,
  HitsAssigned: Assigned,
  RetreatDeclared: Declared,
  ShipsRetreated: Retreated,
  SpaceCombatEnded: Ended,
  BombardmentRolled: Bombardment,
  GroundForcesCommitted: Landing,
  SpaceCannonDefenseFired: DefenseFire,
  GroundCombatRoundRolled: GroundRound,
  GroundCombatEnded: GroundEnded,
  PlanetControlGained: ControlGained,
  CenterTokenRemoved: CenterToken,
  CombatBonusGranted: BonusGranted,
  HitsCancelled,
};

function Entry({ game, event }: EntryProps): ReactElement {
  const Render = RENDERERS[event.type] as ((props: EntryProps) => ReactElement) | undefined;
  return Render === undefined ? (
    <Simple game={game} event={event} />
  ) : (
    <Render game={game} event={event} />
  );
}

/** Kampfverlauf, neueste Einträge unten; scrollt automatisch mit. */
export function CombatLog({
  game,
  log,
}: {
  readonly game: GameState;
  readonly log: readonly CombatLogEvent[];
}): ReactElement {
  const t = useT();
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (box.current !== null) box.current.scrollTop = box.current.scrollHeight;
  }, [log.length]);
  return (
    <section ref={box} className="combat-log" aria-label={t('combatLog')}>
      <ol>
        {log.map((event, index) => (
          <li key={index} className={`log-${event.type}`}>
            <Entry game={game} event={event} />
          </li>
        ))}
      </ol>
    </section>
  );
}
