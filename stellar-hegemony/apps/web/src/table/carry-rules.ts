import type { GameState, PlayerId } from '@stellar/domain';
import { activatableSystems } from './legal-systems.ts';
import type { PlanetTable } from './planet-table.ts';
import { canMove } from './pool-draft.ts';
import type { TableDraft } from './table-specs.ts';
import {
  DRAFT_ZONES,
  GOODS_PIECE,
  KASSE,
  poolTarget,
  systemTarget,
  type TargetRef,
  targetKey,
} from './target-ref.ts';
import { useChosenCard } from './use-decision-route.ts';
import { usePlanetTable } from './use-planet-table.ts';
import { useTableDecision } from './use-table-decision.ts';

/*
 * Wohin ein aufgenommenes Stück darf (reine Funktion): Während einer Verteilung wandern Marker
 * zwischen Schale und Leisten, sonst aktiviert der Taktikmarker ein erlaubtes System. Während
 * einer Bezahlung wandern Handelswaren in die Kasse und wieder zurück.
 */

/** Münzen einer offenen Bezahlung: was in der Kasse liegt und was man besitzt. */
export interface CoinCount {
  readonly spent: number;
  readonly own: number;
}

export interface CarryInput {
  readonly game: GameState;
  readonly actor: PlayerId | null;
  /** Eine strategische Aktion ist gewählt; dann wird nichts aktiviert. */
  readonly choosing: boolean;
  readonly draft: TableDraft | null;
  /** Offene Bezahlung mit Handelswaren; sonst `null`. */
  readonly coins: CoinCount | null;
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

const isCoin = (piece: TargetRef): boolean => piece.kind === 'goods' || piece.kind === 'slot';

export function legalFor(input: CarryInput, piece: TargetRef): ReadonlySet<string> {
  const { game, actor, choosing, draft } = input;
  if (isCoin(piece)) return coinTargets(input.coins, piece);
  if (draft !== null) return draftTargets(draft, piece);
  if (!isTactic(piece) || actor === null || choosing) return NOWHERE;
  return new Set(activatableSystems(game, actor).map((id) => targetKey(systemTarget(id))));
}

/** Die Münzen der Planetenreihe, wenn Handelswaren mitzahlen. */
export const coinsOf = (table: PlanetTable | null): CoinCount | null =>
  table === null || table.tradeGoods === null
    ? null
    : { spent: table.tradeGoods, own: table.ownTradeGoods };

/** Für die Stücke am Bildschirm: liefert zu jedem Stück seine erlaubten Ziele. */
export function useLegalFor(game: GameState | null): (piece: TargetRef) => ReadonlySet<string> {
  const decision = useTableDecision(game);
  const actor = decision?.route.kind === 'waiting' ? null : (decision?.route.actor ?? null);
  const choosing = useChosenCard(actor) !== null;
  const draft = decision?.draft ?? null;
  const coins = coinsOf(usePlanetTable(game));
  return (piece) =>
    game === null ? NOWHERE : legalFor({ game, actor, choosing, draft, coins }, piece);
}
