import type { GameState, PlayerId } from '@stellar/domain';
import { activatableSystems } from './legal-systems.ts';
import type { PlanetTable } from './planet-table.ts';
import { canMove } from './pool-draft.ts';
import type { TableDraft } from './table-specs.ts';
import {
  DRAFT_ZONES,
  GOODS_PIECE,
  isCoinRef,
  KASSE,
  poolTarget,
  systemTarget,
  type TargetRef,
  targetKey,
} from './target-ref.ts';
import { useChosenCard } from './use-decision-route.ts';
import { usePlanetTable } from './use-planet-table.ts';
import { type TableDecision, useTableDecision } from './use-table-decision.ts';

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
  /** Erlaubte Ziele laut Entscheidung, für Entwürfe ohne Marker (Figuren, Gebäude). */
  readonly specLegal?: (piece: TargetRef) => ReadonlySet<string>;
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

export function legalFor(input: CarryInput, piece: TargetRef): ReadonlySet<string> {
  const { game, actor, choosing, draft } = input;
  if (isCoinRef(piece)) return coinTargets(input.coins, piece);
  if (draft !== null) return ofDraft(input, draft, piece);
  if (!isTactic(piece) || actor === null || choosing) return NOWHERE;
  return new Set(activatableSystems(game, actor).map((id) => targetKey(systemTarget(id))));
}

/** Die Münzen der Planetenreihe, wenn Handelswaren mitzahlen. */
export const coinsOf = (table: PlanetTable | null): CoinCount | null =>
  table === null || table.tradeGoods === null
    ? null
    : { spent: table.tradeGoods, own: table.ownTradeGoods };

/** Was die Entscheidung zum Tragen beiträgt: Handelnder, Entwurf und ihre erlaubten Ziele. */
function fromDecision(decision: TableDecision | null) {
  if (decision === null) return { actor: null, draft: null, specLegal: () => NOWHERE };
  const { route, draft, legalFor: specLegal } = decision;
  return { actor: route.kind === 'waiting' ? null : route.actor, draft, specLegal };
}

/** Für die Stücke am Bildschirm: liefert zu jedem Stück seine erlaubten Ziele. */
export function useLegalFor(game: GameState | null): (piece: TargetRef) => ReadonlySet<string> {
  const own = fromDecision(useTableDecision(game));
  const choosing = useChosenCard(own.actor) !== null;
  const coins = coinsOf(usePlanetTable(game));
  return (piece) => (game === null ? NOWHERE : legalFor({ ...own, game, choosing, coins }, piece));
}
