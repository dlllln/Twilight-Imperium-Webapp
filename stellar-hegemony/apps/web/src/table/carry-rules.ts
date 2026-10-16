import type { GameState, PlayerId } from '@stellar/domain';
import { activatableSystems } from './legal-systems.ts';
import { canMove } from './pool-draft.ts';
import type { TableDraft } from './table-specs.ts';
import { DRAFT_ZONES, poolTarget, systemTarget, type TargetRef, targetKey } from './target-ref.ts';
import { useChosenCard } from './use-decision-route.ts';
import { useTableDecision } from './use-table-decision.ts';

/*
 * Wohin ein aufgenommenes Stück darf (reine Funktion): Während einer Verteilung wandern Marker
 * zwischen Schale und Leisten, sonst aktiviert der Taktikmarker ein erlaubtes System.
 */

export interface CarryInput {
  readonly game: GameState;
  readonly actor: PlayerId | null;
  /** Eine strategische Aktion ist gewählt; dann wird nichts aktiviert. */
  readonly choosing: boolean;
  readonly draft: TableDraft | null;
}

const NOWHERE: ReadonlySet<string> = new Set();

function draftTargets(draft: TableDraft, piece: TargetRef): ReadonlySet<string> {
  if (piece.kind !== 'pool') return NOWHERE;
  const from = piece.pool;
  const zones = DRAFT_ZONES.filter((zone) => canMove(draft.pools, from, zone));
  return new Set(zones.map((zone) => targetKey(poolTarget(zone))));
}

const isTactic = (piece: TargetRef): boolean => piece.kind === 'pool' && piece.pool === 'tactic';

export function legalFor(input: CarryInput, piece: TargetRef): ReadonlySet<string> {
  const { game, actor, choosing, draft } = input;
  if (draft !== null) return draftTargets(draft, piece);
  if (!isTactic(piece) || actor === null || choosing) return NOWHERE;
  return new Set(activatableSystems(game, actor).map((id) => targetKey(systemTarget(id))));
}

/** Für die Stücke am Bildschirm: liefert zu jedem Stück seine erlaubten Ziele. */
export function useLegalFor(game: GameState | null): (piece: TargetRef) => ReadonlySet<string> {
  const decision = useTableDecision(game);
  const actor = decision?.route.kind === 'waiting' ? null : (decision?.route.actor ?? null);
  const choosing = useChosenCard(actor) !== null;
  const draft = decision?.draft ?? null;
  return (piece) => (game === null ? NOWHERE : legalFor({ game, actor, choosing, draft }, piece));
}
