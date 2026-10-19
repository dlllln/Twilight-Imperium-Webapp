import type {
  GameCommand,
  GameState,
  ObjectiveId,
  PlanetId,
  PlayerId,
  SystemId,
} from '@stellar/domain';
import type { MessageKey } from '../i18n.ts';
import type { DecisionRoute } from './decision-route.ts';
import type { PaymentPlan } from './payment-draft.ts';
import type { PlanetSide } from './planet-table.ts';
import type { PoolDraft } from './pool-draft.ts';
import type { DraftZone, TargetState } from './target-ref.ts';

/*
 * Verträge der Entscheidungen, die am Tisch gespielt werden: Jede ist ein Satz kleiner reiner
 * Funktionen über einem Entwurf. Der Entwurf wächst je Iteration um weitere Arten (`kind`).
 */

export type TableSpecId =
  'tokens' | 'leadership' | 'warfare' | 'scoring' | 'imperial' | 'diplomacy';

/** Entwurf einer Markerverteilung samt Bezahlung (Führung) und System (Kriegsführung). */
export interface TokenPlan {
  readonly kind: 'tokens';
  readonly pools: PoolDraft;
  readonly tradeGoods: number;
  /** Führung: vorgemerkte Einflussplaneten. */
  readonly planets: readonly PlanetId[];
  readonly system: SystemId | null;
}

/** Wertung und Imperium: der gewählte Auftrag und, bei Ausgabe-Aufträgen, die Bezahlung. */
export interface ObjectivePlan {
  readonly kind: 'objective';
  readonly objective: ObjectiveId | null;
  readonly payment: PaymentPlan | null;
}

/** Diplomatie sekundär: die Planeten, die bereitgemacht werden. */
export interface ReadyPlan {
  readonly kind: 'ready';
  readonly planets: readonly PlanetId[];
}

export type TableDraft = TokenPlan | ObjectivePlan | ReadyPlan;

export type TableAction =
  | { readonly kind: 'move'; readonly from: DraftZone; readonly to: DraftZone }
  | { readonly kind: 'system'; readonly system: SystemId }
  | { readonly kind: 'tradeGoods'; readonly delta: 1 | -1 }
  | { readonly kind: 'planet'; readonly planet: PlanetId }
  | { readonly kind: 'objective'; readonly objective: ObjectiveId | null };

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

/** Die zweite Möglichkeit neben dem Siegel: eine Handlung am Entwurf oder ein eigener Befehl. */
export interface SpecAlternative {
  readonly label: MessageKey;
  readonly action?: TableAction;
  readonly command?: GameCommand;
}

export interface TableSpec<D extends { readonly kind: string }, A> {
  readonly id: TableSpecId;
  readonly hint: (ctx: SpecContext) => MessageKey;
  /** Beschriftung des Siegels; sie behält die bekannten Namen (z. B. „Ausführen“). */
  readonly confirm: (ctx: SpecContext, draft: D) => MessageKey;
  readonly initial: (ctx: SpecContext) => D;
  readonly apply: (ctx: SpecContext, draft: D, action: A) => D;
  /** Zielschlüssel (`targetKey`) mit ihrem Zustand. */
  readonly targets: (ctx: SpecContext, draft: D) => ReadonlyMap<string, TargetState>;
  readonly progress: (ctx: SpecContext, draft: D) => Progress;
  readonly command: (ctx: SpecContext, draft: D) => GameCommand;
  /** `null` heißt: wie üblich ablehnen (sekundär) oder abbrechen (primär). */
  readonly alternative?: (ctx: SpecContext, draft: D) => SpecAlternative | null;
  /** Welche Planeten die Planetenreihe gerade anbietet; `null`, wenn keine. */
  readonly planets?: (ctx: SpecContext, draft: D) => PlanetSide | null;
}

export type PoolSpec = TableSpec<TokenPlan, TableAction>;

export type AnySpec = TableSpec<TableDraft, TableAction>;

type DraftOf<K extends TableDraft['kind']> = Extract<TableDraft, { readonly kind: K }>;

/** Ein Entwurf der erwarteten Art, sonst der Anfang der Entscheidung. */
const narrowed = <K extends TableDraft['kind']>(
  spec: TableSpec<DraftOf<K>, TableAction>,
  kind: K,
  ctx: SpecContext,
  draft: TableDraft,
): DraftOf<K> => (draft.kind === kind ? (draft as DraftOf<K>) : spec.initial(ctx));

/** Macht eine Entscheidung mit eigenem Entwurf zu einem Eintrag der gemeinsamen Liste. */
export function widenSpec<K extends TableDraft['kind']>(
  spec: TableSpec<DraftOf<K>, TableAction>,
  kind: K,
): AnySpec {
  const own = (ctx: SpecContext, draft: TableDraft) => narrowed(spec, kind, ctx, draft);
  const { id, hint, initial, alternative, planets } = spec;
  return {
    id,
    hint,
    initial,
    apply: (ctx, draft, action) => spec.apply(ctx, own(ctx, draft), action),
    targets: (ctx, draft) => spec.targets(ctx, own(ctx, draft)),
    progress: (ctx, draft) => spec.progress(ctx, own(ctx, draft)),
    confirm: (ctx, draft) => spec.confirm(ctx, own(ctx, draft)),
    command: (ctx, draft) => spec.command(ctx, own(ctx, draft)),
    ...(alternative && { alternative: (ctx, draft) => alternative(ctx, own(ctx, draft)) }),
    ...(planets && { planets: (ctx, draft) => planets(ctx, own(ctx, draft)) }),
  };
}
