import {
  type GameCommand,
  type GameState,
  type HandCard,
  handCards,
  type PlayerId,
} from '@stellar/domain';
import { useMemo } from 'react';
import { useGameStore, useViewer } from '../game-store.ts';
import { useSettingsStore } from '../settings-store.ts';
import { content } from '../store.ts';
import { cardDropTarget } from './card-targets.ts';
import { canActivateNow } from './legal-systems.ts';
import type { PlanetTable } from './planet-table.ts';
import { useSocketPlay } from './socket-play.ts';
import {
  type TableAction,
  type TableDraft,
  type TableSpecId,
  takesPlayer,
  takesSystem,
} from './table-specs.ts';
import type { DropHandler, TargetRef } from './target-ref.ts';
import { useChosenCard } from './use-decision-route.ts';
import { usePlanetTable } from './use-planet-table.ts';
import { type TableDecision, useTableDecision } from './use-table-decision.ts';

/*
 * Was ein abgelegtes Stück bewirkt (reine Funktion): Der Taktikmarker auf einem System schickt
 * `ActivateSystem` sofort, eine Handelsware wandert in die Kasse der offenen Bezahlung, alles
 * andere füllt nur den Entwurf der laufenden Entscheidung: Marker auf Leisten, Figuren auf
 * Planeten oder zurück in den Weltraum, Gebäude auf Planeten, der Sprechermarker auf das Bild
 * eines Mitspielers. Eine Aktionskarte aus der Hand auf einem ihrer Ziele spielt sie sofort aus,
 * der oberste Strategiemarker im Sockel der Ansage führt die Sekundärfähigkeit aus.
 */

export interface DropInput {
  readonly game: GameState;
  readonly actor: PlayerId | null;
  readonly choosing: boolean;
  readonly specId: TableSpecId | null;
  readonly draft: TableDraft | null;
  /** Wessen Hand am Bildschirm liegt; nur diese Karten lassen sich auf Ziele legen. */
  readonly viewer?: PlayerId | null;
  /** Die Aktionskarten des Betrachters samt Spielbarkeit und Zielen (`handCards`). */
  readonly cards?: readonly HandCard[];
  /** Der Sockel der Sekundärfähigkeit nimmt gerade einen Strategiemarker an. */
  readonly socket?: boolean;
}

export type DropIntent =
  | { readonly kind: 'send'; readonly command: GameCommand }
  | { readonly kind: 'act'; readonly action: TableAction }
  | { readonly kind: 'coins'; readonly delta: 1 | -1 }
  | { readonly kind: 'socket' }
  | null;

function activation(input: DropInput, piece: TargetRef, target: TargetRef): DropIntent {
  const { game, actor, choosing } = input;
  const tactic = piece.kind === 'pool' && piece.pool === 'tactic';
  if (!tactic || target.kind !== 'system' || actor === null) return null;
  if (!canActivateNow(game, actor, target.id, choosing)) return null;
  return { kind: 'send', command: { type: 'ActivateSystem', issuedBy: actor, system: target.id } };
}

const isKasse = (ref: TargetRef): boolean => ref.kind === 'slot' && ref.name === 'kasse';

/** Der oberste Strategiemarker im Sockel der Ansage: der Sekundärfähigkeit folgen. */
const socketDrop = (input: DropInput, piece: TargetRef, target: TargetRef): boolean =>
  input.socket === true &&
  piece.kind === 'pool' &&
  piece.pool === 'strategy' &&
  target.kind === 'slot' &&
  target.name === 'socket';

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

/** Eine spielbare Aktionskarte des Betrachters auf einem ihrer Ziele: sofort ausspielen. */
function cardIntent(input: DropInput, card: HandCard | undefined, target: TargetRef): DropIntent {
  const viewer = input.viewer ?? null;
  if (viewer === null || card === undefined || !card.playable) return null;
  const chosen = cardDropTarget(card.targets, target);
  if (chosen === null) return null;
  const command: GameCommand = {
    type: 'PlayActionCard',
    issuedBy: viewer,
    card: card.definition.id,
    target: chosen,
  };
  return { kind: 'send', command };
}

/** Karten und der Sprechermarker; `undefined`, wenn das Stück keines von beiden ist. */
function peopleIntent(
  input: DropInput,
  piece: TargetRef,
  target: TargetRef,
): DropIntent | undefined {
  if (piece.kind === 'action') {
    const card = input.cards?.find((entry) => entry.definition.id === piece.id);
    return cardIntent(input, card, target);
  }
  if (piece.kind !== 'speaker') return undefined;
  if (target.kind !== 'player' || !takesPlayer(input.specId)) return null;
  return { kind: 'act', action: { kind: 'player', player: target.id } };
}

export function dropIntent(input: DropInput, piece: TargetRef, target: TargetRef): DropIntent {
  if (socketDrop(input, piece, target)) return { kind: 'socket' };
  const coins = coinIntent(piece, target);
  if (coins !== null) return coins;
  const people = peopleIntent(input, piece, target);
  if (people !== undefined) return people;
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

/** Was eine Absicht ausführt: Entscheidung, Planetenreihe und der Sockel. */
interface Performers {
  readonly decision: TableDecision | null;
  readonly planets: PlanetTable | null;
  readonly play: (() => void) | null;
}

/** Führt eine Absicht aus; Münzen ohne offene Bezahlung bewirken nichts. */
function perform(
  intent: NonNullable<DropIntent>,
  { decision, planets, play }: Performers,
): boolean {
  if (intent.kind === 'send') sendNow(intent.command);
  if (intent.kind === 'act') decision?.act(intent.action);
  if (intent.kind === 'socket') play?.();
  if (intent.kind !== 'coins') return true;
  planets?.addCoins(intent.delta);
  return planets !== null;
}

const NO_CARDS: readonly HandCard[] = [];

/** Die Aktionskarten des Betrachters, einmal je Spielstand ermittelt. */
function useViewerCards(game: GameState, viewer: PlayerId | null): readonly HandCard[] {
  return useMemo(
    () => (viewer === null ? NO_CARDS : handCards(game, viewer, content)),
    [game, viewer],
  );
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
  const viewer = useViewer();
  const cards = useViewerCards(game, viewer);
  const { play, takesToken: socket } = useSocketPlay(game);
  const input = { game, actor, choosing, specId: decision?.specId ?? null, viewer, cards, socket };
  return (piece, target) => {
    const intent = dropIntent({ ...input, draft: decision?.draft ?? null }, piece, target);
    return intent !== null && perform(intent, { decision, planets, play });
  };
}
