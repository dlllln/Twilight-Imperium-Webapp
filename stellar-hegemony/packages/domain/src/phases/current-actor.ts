import { reactionActor } from '../action-card/action-card-queries.ts';
import { excessActionCards } from '../action-card/draw.ts';
import { agendaActor } from '../agenda/agenda-queries.ts';
import { tacticalDecider } from '../combat/tactical-flow.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import { statusActor } from '../status/status-commands.ts';

/** In der Aktionsphase: Sekundärfähigkeit, Tauschangebot, Kampfentscheidung, sonst der Zug. */
function actionActor(state: GameState): PlayerId | null {
  const turn = state.actionPhase;
  if (turn === null) return null;
  return (
    turn.secondary?.awaiting[0] ?? turn.transaction?.to ?? tacticalDecider(state) ?? turn.active
  );
}

/** Wer vor allem anderen dran ist: Geheimauftrags-Wahl, Reaktion, dann Ablegen über dem Limit. */
function interruptingActor(state: GameState): PlayerId | null {
  const choosing = state.players.find((player) => player.secretChoice !== null);
  if (choosing !== undefined) return choosing.id;
  const reacting = reactionActor(state);
  if (reacting !== null) return reacting;
  return state.players.find((player) => excessActionCards(state, player.id) > 0)?.id ?? null;
}

/**
 * Information Expert: wer als Nächstes entscheiden muss. Hot-Seat, Bots und Server
 * fragen dieselbe Stelle, damit niemand auf eine Entscheidung wartet, die keiner sieht.
 */
export function currentActor(state: GameState): PlayerId | null {
  if (state.phase === 'gameOver') return null;
  const interrupting = interruptingActor(state);
  if (interrupting !== null) return interrupting;
  if (state.phase === 'strategy') return state.pickQueue[0] ?? null;
  if (state.phase === 'status') return statusActor(state);
  if (state.phase === 'agenda') return agendaActor(state);
  return state.phase === 'action' ? actionActor(state) : null;
}
