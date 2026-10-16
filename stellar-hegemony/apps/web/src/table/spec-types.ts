import type { GameCommand, GameState, PlayerId, SystemId } from '@stellar/domain';
import type { MessageKey } from '../i18n.ts';
import type { DecisionRoute } from './decision-route.ts';
import type { PoolDraft } from './pool-draft.ts';
import type { DraftZone, TargetState } from './target-ref.ts';

/*
 * Verträge der Entscheidungen, die am Tisch gespielt werden: Jede ist ein Satz kleiner reiner
 * Funktionen über einem Entwurf. Der Entwurf wächst je Iteration um weitere Arten (`kind`).
 */

export type TableSpecId = 'tokens' | 'leadership' | 'warfare';

/** Entwurf einer Markerverteilung samt Handelswaren (Führung) und System (Kriegsführung). */
export interface TokenPlan {
  readonly kind: 'tokens';
  readonly pools: PoolDraft;
  readonly tradeGoods: number;
  readonly system: SystemId | null;
}

export type TableDraft = TokenPlan;

export type TableAction =
  | { readonly kind: 'move'; readonly from: DraftZone; readonly to: DraftZone }
  | { readonly kind: 'system'; readonly system: SystemId }
  | { readonly kind: 'tradeGoods'; readonly delta: 1 | -1 };

export interface SpecContext {
  readonly game: GameState;
  readonly actor: PlayerId;
  readonly route: DecisionRoute;
}

/** Fortschritt für das Messgerät der Ansage: erledigt / nötig, und ob das Siegel bereit ist. */
export interface Progress {
  readonly done: number;
  readonly needed: number;
  readonly ready: boolean;
}

export interface TableSpec<D extends { readonly kind: string }, A> {
  readonly id: TableSpecId;
  readonly hint: MessageKey;
  /** Beschriftung des Siegels; sie behält die bekannten Namen (z. B. „Ausführen“). */
  readonly confirm: (ctx: SpecContext, draft: D) => MessageKey;
  readonly initial: (ctx: SpecContext) => D;
  readonly apply: (ctx: SpecContext, draft: D, action: A) => D;
  /** Zielschlüssel (`targetKey`) mit ihrem Zustand. */
  readonly targets: (ctx: SpecContext, draft: D) => ReadonlyMap<string, TargetState>;
  readonly progress: (ctx: SpecContext, draft: D) => Progress;
  readonly command: (ctx: SpecContext, draft: D) => GameCommand;
}

export type PoolSpec = TableSpec<TokenPlan, TableAction>;
