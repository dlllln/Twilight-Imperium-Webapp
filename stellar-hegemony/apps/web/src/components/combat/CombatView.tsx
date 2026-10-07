import type { GameState, PlayerId, SystemId } from '@stellar/domain';
import type { ReactElement } from 'react';
import { type CombatLogEvent, combatDecision, combatParties } from '../../combat-view.ts';
import { useGameStore } from '../../game-store.ts';
import type { MessageKey } from '../../i18n.ts';
import { systemLabel } from '../../labels.ts';
import { combatBackdrop } from '../../render/images.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { CombatLog } from './CombatLog.tsx';
import { FleetColumn } from './FleetColumn.tsx';
import { HitAssignmentForm } from './HitAssignmentForm.tsx';
import { RetreatForm } from './RetreatForm.tsx';

/** Das erste Ereignis des Protokolls nennt immer das umkämpfte System. */
const systemOf = (log: readonly CombatLogEvent[]): SystemId | null => {
  const first = log[0];
  return first !== undefined && 'system' in first ? first.system : null;
};

function roleOf(game: GameState, log: readonly CombatLogEvent[], player: PlayerId): MessageKey {
  if (game.actionPhase?.active === player) return 'attacker';
  const started = log.find((event) => event.type === 'SpaceCombatStarted');
  if (started?.defender === player) return 'defender';
  return 'bystander';
}

/** Aktuelle Entscheidung oder, wenn nichts mehr offen ist, der Knopf zum Schließen. */
function DecisionArea({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const close = useGameStore((state) => state.closeCombat);
  const decision = combatDecision(game, content);
  if (decision === null)
    return (
      <button type="button" className="primary" onClick={close}>
        {t('closeCombat')}
      </button>
    );
  return (
    <>
      <p className="decider">
        <PlayerTag game={game} id={decision.player} /> {t('decides')}
      </p>
      {decision.kind === 'hits' ? (
        <HitAssignmentForm
          key={`${decision.player}-${String(decision.hits)}`}
          game={game}
          {...decision}
        />
      ) : (
        <RetreatForm game={game} player={decision.player} targets={decision.targets} />
      )}
    </>
  );
}

function Fleets({
  game,
  system,
  log,
}: {
  readonly game: GameState;
  readonly system: SystemId;
  readonly log: readonly CombatLogEvent[];
}): ReactElement {
  return (
    <div className="combat-fleets">
      {combatParties(game, log).map((player) => (
        <FleetColumn
          key={player}
          game={game}
          system={system}
          player={player}
          role={roleOf(game, log, player)}
          log={log}
        />
      ))}
    </div>
  );
}

/**
 * Eigene Kampfansicht über der Karte: beide Flotten als Miniaturen, Würfelprotokoll
 * und die gerade offene Entscheidung (Treffer zuweisen, Rückzug).
 */
export function CombatView(): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  const game = useGameStore((state) => state.game);
  const open = useGameStore((state) => state.combatOpen);
  const log = useGameStore((state) => state.combatLog);
  const system = systemOf(log);
  if (game === null || !open || system === null) return null;
  const backdrop = combatBackdrop();
  return (
    <div className="combat-overlay" role="dialog" aria-modal="true" aria-label={t('spaceCombat')}>
      <div
        className="combat-view"
        style={backdrop === null ? {} : { backgroundImage: `url(${backdrop})` }}
      >
        <header className="combat-header">
          <h2>{t('spaceCombat')}</h2>
          <p>{systemLabel(game, system, language)}</p>
        </header>
        <Fleets game={game} system={system} log={log} />
        <CombatLog game={game} log={log} />
        <footer className="combat-footer">
          <DecisionArea game={game} />
        </footer>
      </div>
    </div>
  );
}
