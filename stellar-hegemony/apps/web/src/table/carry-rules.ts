import type { GameState, Goods, PlayerId } from '@stellar/domain';
import { activatableSystems } from './legal-systems.ts';
import type { PlanetTable } from './planet-table.ts';
import { canMove } from './pool-draft.ts';
import { useSocketPlay } from './socket-play.ts';
import type { TableDraft } from './table-specs.ts';
import {
  DRAFT_ZONES,
  GOODS_PIECE,
  isCoinRef,
  KASSE,
  playerTarget,
  poolTarget,
  SOCKET,
  systemTarget,
  type TargetRef,
  targetKey,
} from './target-ref.ts';
import { useChosenCard } from './use-decision-route.ts';
import { usePlanetTable } from './use-planet-table.ts';
import { type TableDecision, useTableDecision } from './use-table-decision.ts';
import { type TradeMat, useTradeMat } from './use-trade-mat.ts';

/*
 * Wohin ein aufgenommenes Stück darf (reine Funktion): Während einer Verteilung wandern Marker
 * zwischen Schale und Leisten, sonst aktiviert der Taktikmarker ein erlaubtes System. Während
 * einer Bezahlung wandern Handelswaren in die Kasse und wieder zurück. Liegt die Handelsmatte,
 * dürfen Münzen und Kisten auf das Bild eines Handelspartners, solange Vorrat übrig ist.
 */

/** Münzen einer offenen Bezahlung: was in der Kasse liegt und was man ohne die Matte besitzt. */
export interface CoinCount {
  readonly spent: number;
  readonly own: number;
}

/** Die Handelsmatte, soweit das Tragen sie braucht: Partner, schon Gegebenes und Vorrat. */
export interface TradeCarry {
  readonly partners: readonly PlayerId[];
  readonly give: Goods;
  readonly own: Goods;
}

export interface CarryInput {
  readonly game: GameState;
  readonly actor: PlayerId | null;
  /** Eine strategische Aktion ist gewählt; dann wird nichts aktiviert. */
  readonly choosing: boolean;
  readonly draft: TableDraft | null;
  /** Offene Bezahlung mit Handelswaren; sonst `null`. */
  readonly coins: CoinCount | null;
  /** Erlaubte Ziele laut Entscheidung, für Entwürfe ohne Marker (Figuren, Gebäude). */
  readonly specLegal?: (piece: TargetRef) => ReadonlySet<string>;
  /** Liegt die Handelsmatte; sonst `null` oder nicht angegeben. */
  readonly trade?: TradeCarry | null;
}

const NOWHERE: ReadonlySet<string> = new Set();

function draftTargets(draft: TableDraft, piece: TargetRef): ReadonlySet<string> {
  if (piece.kind !== 'pool' || draft.kind !== 'tokens') return NOWHERE;
  const from = piece.pool;
  const zones = DRAFT_ZONES.filter((zone) => canMove(draft.pools, from, zone));
  return new Set(zones.map((zone) => targetKey(poolTarget(zone))));
}

const isTactic = (piece: TargetRef): boolean => piece.kind === 'pool' && piece.pool === 'tactic';

/** Eine Münze darf in die Kasse, solange Vorrat übrig ist, und zurück, solange dort eine liegt. */
function coinTargets(coins: CoinCount | null, piece: TargetRef): ReadonlySet<string> {
  if (coins === null) return NOWHERE;
  if (piece.kind === 'goods')
    return coins.spent < coins.own ? new Set([targetKey(KASSE)]) : NOWHERE;
  return coins.spent > 0 ? new Set([targetKey(GOODS_PIECE)]) : NOWHERE;
}

/** Marker wandern nach den Regeln der Verteilung, alle anderen Stücke nach der Entscheidung. */
function ofDraft(input: CarryInput, draft: TableDraft, piece: TargetRef): ReadonlySet<string> {
  if (draft.kind === 'tokens') return draftTargets(draft, piece);
  return input.specLegal?.(piece) ?? NOWHERE;
}

/** Münzen und Kisten auf die Bilder der Handelspartner, solange von dieser Ware etwas übrig ist. */
function tradeTargets(trade: TradeCarry | null | undefined, piece: TargetRef): ReadonlySet<string> {
  if (trade == null || piece.kind !== 'goods') return NOWHERE;
  if (trade.give[piece.good] >= trade.own[piece.good]) return NOWHERE;
  return new Set(trade.partners.map((id) => targetKey(playerTarget(id))));
}

/** Waren: Kasse der Bezahlung und Bilder der Handelspartner zusammen. */
function goodsTargets(input: CarryInput, piece: TargetRef): ReadonlySet<string> {
  const coins = isCoinRef(piece) ? coinTargets(input.coins, piece) : NOWHERE;
  return new Set([...coins, ...tradeTargets(input.trade, piece)]);
}

export function legalFor(input: CarryInput, piece: TargetRef): ReadonlySet<string> {
  const { game, actor, choosing, draft } = input;
  if (isCoinRef(piece) || piece.kind === 'goods') return goodsTargets(input, piece);
  if (draft !== null) return ofDraft(input, draft, piece);
  if (!isTactic(piece) || actor === null || choosing) return NOWHERE;
  return new Set(activatableSystems(game, actor).map((id) => targetKey(systemTarget(id))));
}

/** Was das Tragen von der Handelsmatte wissen muss; ohne Matte nichts. */
export const tradeCarryOf = (mat: TradeMat | null): TradeCarry | null =>
  mat === null ? null : { partners: mat.partners, give: mat.draft.give, own: mat.own };

/**
 * Die Münzen der Planetenreihe, wenn Handelswaren mitzahlen. Münzen auf der Handelsmatte
 * (`offered`) stehen der Kasse nicht zur Verfügung: Beide greifen auf denselben Vorrat zu.
 */
export const coinsOf = (table: PlanetTable | null, offered = 0): CoinCount | null =>
  table === null || table.tradeGoods === null
    ? null
    : { spent: table.tradeGoods, own: Math.max(0, table.ownTradeGoods - offered) };

/** Was die Entscheidung zum Tragen beiträgt: Handelnder, Entwurf und ihre erlaubten Ziele. */
function fromDecision(decision: TableDecision | null) {
  if (decision === null) return { actor: null, draft: null, specLegal: () => NOWHERE };
  const { route, draft, legalFor: specLegal } = decision;
  return { actor: route.kind === 'waiting' ? null : route.actor, draft, specLegal };
}

const isStrategyToken = (piece: TargetRef): boolean =>
  piece.kind === 'pool' && piece.pool === 'strategy';

/** Folgt man einer Karte, darf der oberste Strategiemarker zusätzlich in den Sockel. */
export function withSocket(
  legal: ReadonlySet<string>,
  piece: TargetRef,
  socket: boolean,
): ReadonlySet<string> {
  return socket && isStrategyToken(piece) ? new Set([...legal, targetKey(SOCKET)]) : legal;
}

/** Für die Stücke am Bildschirm: liefert zu jedem Stück seine erlaubten Ziele. */
export function useLegalFor(game: GameState | null): (piece: TargetRef) => ReadonlySet<string> {
  const own = fromDecision(useTableDecision(game));
  const choosing = useChosenCard(own.actor) !== null;
  const mat = useTradeMat(game);
  const coins = coinsOf(usePlanetTable(game), mat?.draft.give.tradeGoods);
  const socket = useSocketPlay(game).takesToken;
  const trade = tradeCarryOf(mat);
  return (piece) => {
    if (game === null) return NOWHERE;
    return withSocket(legalFor({ ...own, game, choosing, coins, trade }, piece), piece, socket);
  };
}
