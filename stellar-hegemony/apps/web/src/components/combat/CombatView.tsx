import { type GameState, type PlayerId, reactionActor, type SystemId } from '@stellar/domain';
import type { ReactElement } from 'react';
import {
  type CombatDecision,
  type CombatLogEvent,
  combatDecision,
  combatParties,
  isSpaceBattle,
} from '../../combat-view.ts';
import { useOthersTurn, useGameStore } from '../../game-store.ts';
import type { MessageKey } from '../../i18n.ts';
import { systemLabel } from '../../labels.ts';
import { combatBackdrop } from '../../render/images.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PlayableCards } from '../cards/PlayableCards.tsx';
import { ReactionPrompt } from '../cards/ReactionPrompt.tsx';
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

/** Überschrift: Raumkampf, sobald im Weltraum gekämpft wurde, sonst Einmarsch. */
const titleOf = (log: readonly CombatLogEvent[]): MessageKey =>
  isSpaceBattle(log) ? 'spaceCombat' : 'invasion';

function roleOf(game: GameState, log: readonly CombatLogEvent[], player: PlayerId): MessageKey {
  if (game.actionPhase?.active === player) return 'attacker';
  const started = log.find((event) => event.type === 'SpaceCombatStarted');
  if (started?.defender === player) return 'defender';
  return 'bystander';
}

/** Treffer zuweisen; Karten gegen Treffer stehen direkt daneben (RR 3.10). */
function HitsDecision(props: {
  readonly game: GameState;
  readonly decision: Extract<CombatDecision, { kind: 'hits' }>;
}): ReactElement {
  const { game, decision } = props;
  return (
    <>
      <PlayableCards game={game} player={decision.player} timings={['afterHits']} />
      <HitAssignmentForm
        key={`${decision.player}-${String(decision.hits)}`}
        game={game}
        {...decision}
      />
    </>
  );
}

function BotDeciding(props: { readonly game: GameState; readonly player: PlayerId }): ReactElement {
  const t = useT();
  const bot = useGameStore((state) => state.bots.includes(props.player));
  return (
    <p className="decider">
      <PlayerTag game={props.game} id={props.player} /> {t(bot ? 'botThinking' : 'otherThinking')}
    </p>
  );
}

/** Aktuelle Entscheidung oder, wenn nichts mehr offen ist, der Knopf zum Schließen. */
function DecisionArea({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const close = useGameStore((state) => state.closeCombat);
  const bot = useOthersTurn(game);
  if (bot !== null) return <BotDeciding game={game} player={bot} />;
  if (reactionActor(game) !== null) return <ReactionPrompt game={game} withCards />;
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
        <HitsDecision game={game} decision={decision} />
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
    <div className="combat-overlay" role="dialog" aria-modal="true" aria-label={t(titleOf(log))}>
      <div
        className="combat-view"
        style={backdrop === null ? {} : { backgroundImage: `url(${backdrop})` }}
      >
        <header className="combat-header">
          <h2>{t(titleOf(log))}</h2>
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
