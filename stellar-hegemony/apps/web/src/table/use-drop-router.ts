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
import type { DropHandler, GoodKind, TargetRef } from './target-ref.ts';
import { useChosenCard } from './use-decision-route.ts';
import { usePlanetTable } from './use-planet-table.ts';
import { type TableDecision, useTableDecision } from './use-table-decision.ts';
import { type TradeMat, useTradeMat } from './use-trade-mat.ts';

/*
 * Was ein abgelegtes Stück bewirkt (reine Funktion): Der Taktikmarker auf einem System schickt
 * `ActivateSystem` sofort, eine Handelsware wandert in die Kasse der offenen Bezahlung, alles
 * andere füllt nur den Entwurf der laufenden Entscheidung: Marker auf Leisten, Figuren auf
 * Planeten oder zurück in den Weltraum, Gebäude auf Planeten, der Sprechermarker auf das Bild
 * eines Mitspielers. Eine Aktionskarte aus der Hand auf einem ihrer Ziele spielt sie sofort aus,
 * der oberste Strategiemarker im Sockel der Ansage führt die Sekundärfähigkeit aus. Eine Einheit
 * der Werft im Dock oder im System wird bestellt, auf einem Planeten mit diesem Ziel für neue
 * Bodentruppen. Münzen und Kisten auf dem Bild eines Handelspartners legen sie auf die
 * Handelsmatte. Ein Trefferstift auf einem Schiff der Kampfmatte nimmt dort einen Treffer.
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
  /** Handelspartner der Handelsmatte; leer, wenn sie nicht liegt. */
  readonly partners?: readonly PlayerId[];
}

export type DropIntent =
  | { readonly kind: 'send'; readonly command: GameCommand }
  | { readonly kind: 'act'; readonly action: TableAction }
  | { readonly kind: 'coins'; readonly delta: 1 | -1 }
  | { readonly kind: 'socket' }
  | { readonly kind: 'trade'; readonly partner: PlayerId; readonly good: GoodKind }
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

const isCoin = (ref: TargetRef): boolean => ref.kind === 'goods' && ref.good === 'tradeGoods';

/** Eine Handelsware in die Kasse legen oder aus ihr zurücknehmen. */
function coinIntent(piece: TargetRef, target: TargetRef): DropIntent {
  if (isCoin(piece) && isKasse(target)) return { kind: 'coins', delta: 1 };
  return isKasse(piece) && isCoin(target) ? { kind: 'coins', delta: -1 } : null;
}

/** Münzen und Kisten auf das Bild eines Handelspartners: auf die Handelsmatte legen. */
function tradeIntent(input: DropInput, piece: TargetRef, target: TargetRef): DropIntent {
  if (piece.kind !== 'goods' || target.kind !== 'player') return null;
  if (input.partners?.includes(target.id) !== true) return null;
  return { kind: 'trade', partner: target.id, good: piece.good };
}

/** Waren: in die Kasse, aus ihr zurück oder auf die Handelsmatte. */
const goodsIntent = (input: DropInput, piece: TargetRef, target: TargetRef): DropIntent =>
  coinIntent(piece, target) ?? tradeIntent(input, piece, target);

/** Eine Einheit der Werft: ins Dock oder System bestellt, auf einem Planeten mit diesem Ziel. */
function yardAction(piece: TargetRef, target: TargetRef): TableAction | null {
  if (piece.kind !== 'yard') return null;
  const planet = target.kind === 'site' ? target.id : null;
  const dock = target.kind === 'slot' && target.name === 'dock';
  if (planet === null && !dock && target.kind !== 'system') return null;
  return { kind: 'order', type: piece.type, delta: 1, planet };
}

/** Eine Figur auf einen Planeten oder zurück ins All. */
function unitAction(piece: TargetRef, target: TargetRef): TableAction | null {
  if (piece.kind !== 'unit') return null;
  if (target.kind === 'site') return { kind: 'assign', unit: piece.id, planet: target.id };
  const space = target.kind === 'slot' && target.name === 'space';
  return space ? { kind: 'assign', unit: piece.id, planet: null } : null;
}

/** Figuren auf Planeten oder zurück ins All, Gebäude auf Planeten, Trefferstifte auf Schiffe. */
function pieceAction(piece: TargetRef, target: TargetRef): TableAction | null {
  if (piece.kind === 'peg' && target.kind === 'unit') return { kind: 'peg', unit: target.id };
  if (piece.kind === 'structure' && target.kind === 'site')
    return { kind: 'place', type: piece.type, planet: target.id };
  return unitAction(piece, target) ?? yardAction(piece, target);
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
  const goods = goodsIntent(input, piece, target);
  if (goods !== null) return goods;
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

/** Was eine Absicht ausführt: Entscheidung, Planetenreihe, Sockel und Handelsmatte. */
interface Performers {
  readonly decision: TableDecision | null;
  readonly planets: PlanetTable | null;
  readonly play: (() => void) | null;
  readonly trade: TradeMat | null;
}

type Intent<K extends NonNullable<DropIntent>['kind']> = Extract<DropIntent, { readonly kind: K }>;

/** Münzen in die Kasse; ohne offene Bezahlung bewirken sie nichts. */
function paid(intent: Intent<'coins'>, planets: PlanetTable | null): boolean {
  planets?.addCoins(intent.delta);
  return planets !== null;
}

/** Ware auf die Matte: den Partner wählen und eine Einheit dazugeben. */
function traded(intent: Intent<'trade'>, trade: TradeMat | null): boolean {
  trade?.choose(intent.partner);
  trade?.give(intent.good, 1);
  return trade !== null;
}

/** Führt eine Absicht aus; ob sie etwas bewirkt hat, entscheidet über das Zurückspringen. */
function perform(intent: NonNullable<DropIntent>, performers: Performers): boolean {
  if (intent.kind === 'coins') return paid(intent, performers.planets);
  if (intent.kind === 'trade') return traded(intent, performers.trade);
  if (intent.kind === 'send') sendNow(intent.command);
  if (intent.kind === 'act') performers.decision?.act(intent.action);
  if (intent.kind === 'socket') performers.play?.();
  return true;
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
  const trade = useTradeMat(game);
  const partners = trade?.partners ?? [];
  const specId = decision?.specId ?? null;
  const input = { game, actor, choosing, specId, viewer, cards, socket, partners };
  return (piece, target) => {
    const intent = dropIntent({ ...input, draft: decision?.draft ?? null }, piece, target);
    return intent !== null && perform(intent, { decision, planets, play, trade });
  };
}
