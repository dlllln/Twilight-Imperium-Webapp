import type { GameState } from '@stellar/domain';
import type { ReactElement } from 'react';
import type { CombatLogEvent } from '../../combat-view.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';

type Of<T extends CombatLogEvent['type']> = Extract<CombatLogEvent, { type: T }>;

interface EntryProps<E> {
  readonly game: GameState;
  readonly event: E;
}

/** Aktionskarte mit Kampfbonus (Raumkampfrunde oder Bodenkampf). */
export function BonusGranted({ game, event }: EntryProps<Of<'CombatBonusGranted'>>): ReactElement {
  const t = useT();
  const { player, kind, amount } = event.bonus;
  const text = t(kind === 'space' ? 'spaceBonusLog' : 'groundBonusLog');
  return (
    <p className="card-log">
      <PlayerTag game={game} id={player} /> {text.replace('{n}', String(amount))}
    </p>
  );
}

/** Aktionskarte, die zugewiesene Treffer aufhebt. */
export function HitsCancelled({ game, event }: EntryProps<Of<'HitsCancelled'>>): ReactElement {
  const t = useT();
  return (
    <p className="card-log">
      <PlayerTag game={game} id={event.player} />{' '}
      {t('hitsCancelledLog').replace('{n}', String(event.amount))}
    </p>
  );
}
