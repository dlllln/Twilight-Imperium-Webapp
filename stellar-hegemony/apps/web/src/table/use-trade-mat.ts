import {
  findPlayer,
  type GameState,
  type Goods,
  NO_GOODS,
  type PlayerId,
  tradePartners,
} from '@stellar/domain';
import { useGameStore } from '../game-store.ts';
import { useSettingsStore } from '../settings-store.ts';
import type { DecisionRoute } from './decision-route.ts';
import type { GoodKind } from './target-ref.ts';
import {
  askGoods,
  canPropose,
  choosePartner,
  fitted,
  giveGoods,
  proposalOf,
  type TradeDraft,
} from './trade-draft.ts';
import { draftFor, tradeKey, useTradeStore } from './trade-store.ts';
import { useDecisionRoute } from './use-decision-route.ts';
import { usePlanetTable } from './use-planet-table.ts';

/*
 * Die Handelsmatte (RR 82): Wer am Zug ist, legt Münzen und Kisten auf das Bild eines Nachbarn
 * oder nutzt Plus und Minus der Matte; „Angebot machen“ sendet `ProposeTransaction`. Sie liegt
 * nur in der Tischansicht, außerhalb anderer Entscheidungen und solange kein Angebot offen ist.
 * Kasse und Matte teilen einen Münzvorrat: Münzen in der Kasse einer Bezahlung fehlen der Matte.
 */

export interface TradeMat {
  readonly player: PlayerId;
  /** Nachbarn, mit denen in diesem Zug noch gehandelt werden darf. */
  readonly partners: readonly PlayerId[];
  readonly draft: TradeDraft;
  /** Eigener Vorrat ohne die Münzen in der Kasse und, mit Partner, seiner. */
  readonly own: Goods;
  readonly theirs: Goods | null;
  readonly choose: (partner: PlayerId) => void;
  readonly give: (good: GoodKind, delta: 1 | -1) => void;
  readonly ask: (good: GoodKind, delta: 1 | -1) => void;
  readonly ready: boolean;
  readonly propose: () => void;
}

const goodsOf = (game: GameState, player: PlayerId | null): Goods | null => {
  const found = player === null ? undefined : findPlayer(game, player);
  return found === undefined
    ? null
    : { tradeGoods: found.tradeGoods, commodities: found.commodities };
};

/** Wer gerade handeln darf: der Aktive ohne laufende Entscheidung, ohne offenes Angebot. */
export function traderOf(game: GameState, route: DecisionRoute | null): PlayerId | null {
  const turn = game.actionPhase;
  const idle = route?.kind === 'idle' || route?.kind === 'tactical';
  if (turn == null || !idle || turn.transaction !== null) return null;
  return route.actor === turn.active ? route.actor : null;
}

interface Stand {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly partners: readonly PlayerId[];
  readonly key: string;
  /** Was die Matte geben darf: der eigene Vorrat ohne die Münzen in der Kasse. */
  readonly own: Goods;
}

/** Der eigene Vorrat ohne die Münzen, die gerade in der Kasse einer Bezahlung liegen. */
function spareGoods(game: GameState, player: PlayerId, inKasse: number): Goods {
  const own = goodsOf(game, player) ?? NO_GOODS;
  return { ...own, tradeGoods: Math.max(0, own.tradeGoods - inKasse) };
}

/** Der Entwurf zum Stand, in Partner und Vorräte eingepasst. */
const currentDraft = (stand: Stand, stored: TradeDraft): TradeDraft =>
  fitted(stored, stand.partners, stand.own, goodsOf(stand.game, stored.partner));

function edit(stand: Stand, change: (draft: TradeDraft) => TradeDraft): void {
  useTradeStore.getState().edit(stand.key, (stored) => change(currentDraft(stand, stored)));
}

function handlers(stand: Stand) {
  const { game, own } = stand;
  return {
    choose: (partner: PlayerId) => edit(stand, (draft) => choosePartner(draft, partner)),
    give: (good: GoodKind, delta: 1 | -1) =>
      edit(stand, (draft) => giveGoods(draft, good, delta, own)),
    ask: (good: GoodKind, delta: 1 | -1) =>
      edit(stand, (draft) => askGoods(draft, good, delta, goodsOf(game, draft.partner))),
  };
}

function matOf(stand: Stand, stored: TradeDraft): TradeMat {
  const draft = currentDraft(stand, stored);
  const propose = () => {
    const command = proposalOf(draft, stand.player);
    if (command !== null) useGameStore.getState().send(command);
  };
  const { player, partners, game, own } = stand;
  const theirs = goodsOf(game, draft.partner);
  return {
    player,
    partners,
    draft,
    own,
    theirs,
    ...handlers(stand),
    ready: canPropose(draft),
    propose,
  };
}

/** Die Handelsmatte am Bildschirm; `null`, solange nicht gehandelt werden kann. */
export function useTradeMat(game: GameState | null): TradeMat | null {
  const route = useDecisionRoute(game);
  const table = useSettingsStore((state) => state.tableView);
  const key = useTradeStore((state) => state.key);
  const stored = useTradeStore((state) => state.draft);
  const inKasse = usePlanetTable(game)?.tradeGoods ?? 0;
  const player = game === null || !table ? null : traderOf(game, route);
  if (game === null || player === null) return null;
  const partners = tradePartners(game, player);
  if (partners.length === 0) return null;
  const own = spareGoods(game, player, inKasse);
  const stand = { game, player, partners, key: tradeKey(game.version, player), own };
  return matOf(stand, draftFor({ key, draft: stored }, stand.key));
}

/** Was der Betrachter gerade auf die Handelsmatte gelegt hat; ohne Matte nichts. */
export function useOfferedGoods(game: GameState | null, player: PlayerId | null): Goods {
  const mat = useTradeMat(game);
  return mat !== null && mat.player === player ? mat.draft.give : NO_GOODS;
}
