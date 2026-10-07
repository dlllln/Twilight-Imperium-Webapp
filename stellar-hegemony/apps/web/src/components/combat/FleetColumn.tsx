import { type GameState, type PlayerId, shipsOf, type SystemId, type Unit } from '@stellar/domain';
import type { ReactElement } from 'react';
import type { CombatLogEvent } from '../../combat-view.ts';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import type { MessageKey } from '../../i18n.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { UnitFigure } from './UnitFigure.tsx';

/** Ereignisse, deren Zerstörungen immer das Ziel der Salve treffen. */
const TARGETED = new Set<CombatLogEvent['type']>([
  'AntiFighterBarrageFired',
  'BombardmentRolled',
  'SpaceCannonDefenseFired',
]);

/** Verluste eines Spielers laut Protokoll: zugewiesene Zerstörungen und Jägerabwehr. */
function lossesOf(log: readonly CombatLogEvent[], player: PlayerId): number {
  return log.reduce((sum, event) => {
    if (event.type === 'HitsAssigned' && event.player === player)
      return sum + event.destroyed.length;
    if (TARGETED.has(event.type) && 'volley' in event && event.volley.target === player)
      return sum + ('destroyed' in event ? event.destroyed.length : 0);
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

/** Eigene Einheiten auf den Planeten des Systems (Bodentruppen und Gebäude). */
const groundOf = (game: GameState, system: SystemId, player: PlayerId): readonly Unit[] =>
  (game.systems[system]?.planetIds ?? []).flatMap((id) =>
    (game.planets[id]?.units ?? []).filter((unit) => unit.owner === player),
  );

function GroundRow({ game, units }: { readonly game: GameState; readonly units: readonly Unit[] }) {
  const t = useT();
  if (units.length === 0) return null;
  return (
    <div className="fleet-ground" aria-label={t('onPlanets')}>
      {units.map((unit) => (
        <UnitFigure key={unit.id} game={game} unit={unit} />
      ))}
    </div>
  );
}

/** Eine Seite des Kampfs: Spieler, Rolle, Schiffe und Bodentruppen im System, Verluste. */
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
      <GroundRow game={game} units={groundOf(game, system, player)} />
      <p className="fleet-losses">
        {t('losses')}: {lossesOf(log, player)}
      </p>
    </section>
  );
}
