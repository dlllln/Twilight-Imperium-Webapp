import { findPlayer, type GameState } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PHASE_TITLE } from '../game/TurnPanel.tsx';
import { subtitleOf } from './PromptParts.tsx';

/*
 * Bildschirmleser hören, wenn in der Tischansicht eine neue Entscheidung ansteht oder jemand
 * anderes am Zug ist. Die Ansage selbst erscheint für jede Entscheidung neu und ist bewusst keine
 * Live-Region (sonst würde jedes Formularfeld vorgelesen); diese eine Zeile bleibt dagegen stehen,
 * nur ihr Text wechselt, damit der Wechsel zuverlässig angesagt wird.
 */

interface LineProps {
  readonly game: GameState;
  readonly decision: TableDecision;
}

/** Wer gerade zieht: „Name ist am Zug …“ (bei der KI „… und überlegt …“). */
function WaitingText({ game, decision }: LineProps): ReactElement {
  const t = useT();
  const actor = decision.route.actor;
  const bot = useGameStore((state) => actor !== null && state.bots.includes(actor));
  const name = actor === null ? '' : (findPlayer(game, actor)?.name ?? '');
  return <>{`${name} ${t(bot ? 'botThinking' : 'otherThinking')}`.trim()}</>;
}

/** Phase, Gegenstand und Hinweis der eigenen Entscheidung in einem Satz. */
function DecisionText({ game, decision }: LineProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const hint = decision.hint === null ? null : t(decision.hint);
  const parts = [t(PHASE_TITLE[game.phase]), subtitleOf(decision, t, language, game), hint];
  return <>{parts.filter((part) => part !== null).join(' – ')}</>;
}

function Line(props: LineProps): ReactElement {
  return props.decision.route.kind === 'waiting' ? (
    <WaitingText {...props} />
  ) : (
    <DecisionText {...props} />
  );
}

/** Die Live-Zeile; `open` ist falsch, solange keine Ansage gezeigt wird (z. B. am Kartentisch). */
export function PromptAnnouncer(props: { readonly game: GameState; readonly open: boolean }) {
  const decision = useTableDecision(props.game);
  return (
    <p className="sr-only" aria-live="polite" data-testid="decision-announcer">
      {props.open && decision !== null && <Line game={props.game} decision={decision} />}
    </p>
  );
}
