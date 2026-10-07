import { type GameState, type PlayerId, shipsOf, type SystemId } from '@stellar/domain';
import type { ReactElement } from 'react';
import type { CombatLogEvent } from '../../combat-view.ts';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import type { MessageKey } from '../../i18n.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { UnitFigure } from './UnitFigure.tsx';

/** Verluste eines Spielers laut Protokoll: zugewiesene Zerstörungen und Jägerabwehr. */
function lossesOf(log: readonly CombatLogEvent[], player: PlayerId): number {
  return log.reduce((sum, event) => {
    if (event.type === 'HitsAssigned' && event.player === player)
      return sum + event.destroyed.length;
    if (event.type === 'AntiFighterBarrageFired' && event.volley.target === player)
      return sum + event.destroyed.length;
    return sum;
  }, 0);
}

interface FleetProps {
  readonly game: GameState;
  readonly system: SystemId;
  readonly player: PlayerId;
  readonly role: MessageKey;
  readonly log: readonly CombatLogEvent[];
}

/** Eine Seite des Kampfs: Spieler, Rolle, Schiffe im System und bisherige Verluste. */
export function FleetColumn({ game, system, player, role, log }: FleetProps): ReactElement {
  const t = useT();
  const ships = shipsOf(game, system, player, content.units);
  return (
    <section className="fleet-column" data-player={player}>
      <header>
        <span className="fleet-role">{t(role)}</span>
        <PlayerTag game={game} id={player} />
      </header>
      {ships.length === 0 ? (
        role !== 'bystander' && <p className="hint">{t('noShipsLeft')}</p>
      ) : (
        <div className="fleet-units">
          {ships.map((unit) => (
            <UnitFigure key={unit.id} game={game} unit={unit} />
          ))}
        </div>
      )}
      <p className="fleet-losses">
        {t('losses')}: {lossesOf(log, player)}
      </p>
    </section>
  );
}
