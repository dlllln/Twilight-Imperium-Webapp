import type { GameCommand, GameState, PlayerId } from '@stellar/domain';
import { useGameStore } from '../game-store.ts';
import { useSettingsStore } from '../settings-store.ts';
import { canActivateNow } from './legal-systems.ts';
import type { PlanetTable } from './planet-table.ts';
import { type TableAction, type TableDraft, type TableSpecId, takesSystem } from './table-specs.ts';
import type { DropHandler, TargetRef } from './target-ref.ts';
import { useChosenCard } from './use-decision-route.ts';
import { usePlanetTable } from './use-planet-table.ts';
import { type TableDecision, useTableDecision } from './use-table-decision.ts';

/*
 * Was ein abgelegtes Stück bewirkt (reine Funktion): Der Taktikmarker auf einem System schickt
 * `ActivateSystem` sofort, eine Handelsware wandert in die Kasse der offenen Bezahlung, alles
 * andere füllt nur den Entwurf der laufenden Entscheidung: Marker auf Leisten, Figuren auf
 * Planeten oder zurück in den Weltraum, Gebäude auf Planeten.
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
  | { readonly kind: 'coins'; readonly delta: 1 | -1 }
  | null;

function activation(input: DropInput, piece: TargetRef, target: TargetRef): DropIntent {
  const { game, actor, choosing } = input;
  const tactic = piece.kind === 'pool' && piece.pool === 'tactic';
  if (!tactic || target.kind !== 'system' || actor === null) return null;
  if (!canActivateNow(game, actor, target.id, choosing)) return null;
  return { kind: 'send', command: { type: 'ActivateSystem', issuedBy: actor, system: target.id } };
}

const isKasse = (ref: TargetRef): boolean => ref.kind === 'slot' && ref.name === 'kasse';

/** Eine Handelsware in die Kasse legen oder aus ihr zurücknehmen. */
function coinIntent(piece: TargetRef, target: TargetRef): DropIntent {
  if (piece.kind === 'goods' && isKasse(target)) return { kind: 'coins', delta: 1 };
  return isKasse(piece) && target.kind === 'goods' ? { kind: 'coins', delta: -1 } : null;
}

/** Figuren auf Planeten oder zurück ins All, Gebäude auf Planeten. */
function pieceAction(piece: TargetRef, target: TargetRef): TableAction | null {
  if (piece.kind === 'unit' && target.kind === 'site')
    return { kind: 'assign', unit: piece.id, planet: target.id };
  if (piece.kind === 'unit' && target.kind === 'slot' && target.name === 'space')
    return { kind: 'assign', unit: piece.id, planet: null };
  if (piece.kind === 'structure' && target.kind === 'site')
    return { kind: 'place', type: piece.type, planet: target.id };
  return null;
}

/** Was ein Ablegen am Entwurf ändert; `null`, wenn es dort nichts bewirkt. */
function draftAction(input: DropInput, piece: TargetRef, target: TargetRef): TableAction | null {
  if (piece.kind === 'pool' && target.kind === 'pool')
    return { kind: 'move', from: piece.pool, to: target.pool };
  if (takesSystem(input.specId) && target.kind === 'system')
    return { kind: 'system', system: target.id };
  return pieceAction(piece, target);
}

export function dropIntent(input: DropInput, piece: TargetRef, target: TargetRef): DropIntent {
  const coins = coinIntent(piece, target);
  if (coins !== null) return coins;
  if (input.draft === null) return activation(input, piece, target);
  const action = draftAction(input, piece, target);
  return action === null ? null : { kind: 'act', action };
}

const actorOf = (decision: TableDecision | null): PlayerId | null =>
  decision === null || decision.route.kind === 'waiting' ? null : decision.route.actor;

/** Ein Command geht sofort hinaus; wie ein Klick auf die Karte erledigt er den Erstnutzer-Hinweis. */
function sendNow(command: GameCommand): void {
  useSettingsStore.getState().markHintSeen();
  useGameStore.getState().send(command);
}

/** Führt eine Absicht aus; Münzen ohne offene Bezahlung bewirken nichts. */
function perform(
  intent: NonNullable<DropIntent>,
  decision: TableDecision | null,
  planets: PlanetTable | null,
): boolean {
  if (intent.kind === 'send') sendNow(intent.command);
  if (intent.kind === 'act') decision?.act(intent.action);
  if (intent.kind !== 'coins') return true;
  planets?.addCoins(intent.delta);
  return planets !== null;
}

/**
 * Führt das Ablegen aus: Command senden oder den Entwurf fortschreiben. Liefert `false`, wenn
 * das Ablegen nichts bewirkt; dann springt das Stück zurück, statt als abgelegt zu gelten.
 */
export function useDropRouter(game: GameState): DropHandler {
  const decision = useTableDecision(game);
  const planets = usePlanetTable(game);
  const actor = actorOf(decision);
  const choosing = useChosenCard(actor) !== null;
  const input = { game, actor, choosing, specId: decision?.specId ?? null };
  return (piece, target) => {
    const intent = dropIntent({ ...input, draft: decision?.draft ?? null }, piece, target);
    return intent !== null && perform(intent, decision, planets);
  };
}
