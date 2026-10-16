import type { GameCommand, GameState, PlayerId } from '@stellar/domain';
import { useGameStore } from '../game-store.ts';
import { canActivateNow } from './legal-systems.ts';
import type { TableAction, TableDraft, TableSpecId } from './table-specs.ts';
import type { DropHandler, TargetRef } from './target-ref.ts';
import { useChosenCard } from './use-decision-route.ts';
import { type TableDecision, useTableDecision } from './use-table-decision.ts';

/*
 * Was ein abgelegtes Stück bewirkt (reine Funktion): Der Taktikmarker auf einem System schickt
 * `ActivateSystem` sofort, alles andere füllt nur den Entwurf der laufenden Entscheidung.
 */

export interface DropInput {
  readonly game: GameState;
  readonly actor: PlayerId | null;
  readonly choosing: boolean;
  readonly specId: TableSpecId | null;
  readonly draft: TableDraft | null;
}

export type DropIntent =
  | { readonly kind: 'send'; readonly command: GameCommand }
  | { readonly kind: 'act'; readonly action: TableAction }
  | null;

function activation(input: DropInput, piece: TargetRef, target: TargetRef): DropIntent {
  const { game, actor, choosing } = input;
  const tactic = piece.kind === 'pool' && piece.pool === 'tactic';
  if (!tactic || target.kind !== 'system' || actor === null) return null;
  if (!canActivateNow(game, actor, target.id, choosing)) return null;
  return { kind: 'send', command: { type: 'ActivateSystem', issuedBy: actor, system: target.id } };
}

export function dropIntent(input: DropInput, piece: TargetRef, target: TargetRef): DropIntent {
  if (input.draft === null) return activation(input, piece, target);
  if (piece.kind === 'pool' && target.kind === 'pool')
    return { kind: 'act', action: { kind: 'move', from: piece.pool, to: target.pool } };
  if (input.specId === 'warfare' && target.kind === 'system')
    return { kind: 'act', action: { kind: 'system', system: target.id } };
  return null;
}

const actorOf = (decision: TableDecision | null): PlayerId | null =>
  decision === null || decision.route.kind === 'waiting' ? null : decision.route.actor;

/** Führt das Ablegen aus: Command senden oder den Entwurf fortschreiben. */
export function useDropRouter(game: GameState): DropHandler {
  const decision = useTableDecision(game);
  const send = useGameStore((state) => state.send);
  const actor = actorOf(decision);
  const choosing = useChosenCard(actor) !== null;
  const input = { game, actor, choosing, specId: decision?.specId ?? null };
  return (piece, target) => {
    const intent = dropIntent({ ...input, draft: decision?.draft ?? null }, piece, target);
    if (intent?.kind === 'send') send(intent.command);
    else if (intent?.kind === 'act') decision?.act(intent.action);
  };
}
