import type {
  ActionCardId,
  GameCommand,
  GameState,
  ObjectiveId,
  PlanetId,
  PlayerId,
  StructurePlacement,
  SystemId,
  TechnologyId,
  UnitId,
  UnitTypeId,
} from '@stellar/domain';
import type { MessageKey } from '../i18n.ts';
import type { DecisionRoute } from './decision-route.ts';
import type { PaymentPlan } from './payment-draft.ts';
import type { PlanetSide } from './planet-table.ts';
import type { PoolDraft } from './pool-draft.ts';
import type { DraftZone, TargetRef, TargetState } from './target-ref.ts';

/*
 * Verträge der Entscheidungen, die am Tisch gespielt werden: Jede ist ein Satz kleiner reiner
 * Funktionen über einem Entwurf. Der Entwurf wächst je Iteration um weitere Arten (`kind`).
 */

export type TableSpecId =
  | 'tokens'
  | 'leadership'
  | 'warfare'
  | 'scoring'
  | 'imperial'
  | 'diplomacy'
  | 'bombard'
  | 'landing'
  | 'tacticalDone'
  | 'diplomacyPrimary'
  | 'construction'
  | 'discard'
  | 'reaction'
  | 'politics'
  | 'trade'
  | 'production'
  | 'warfareSecondary'
  | 'technology';

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

/**
 * Bombardement und Landung: welche Figur auf welchen Planeten geht (Schlüssel ist die Einheit).
 * Landen auf der Thronwelt bezahlt zusätzlich Einfluss.
 */
export interface PlacementPlan {
  readonly kind: 'placement';
  readonly assignments: Readonly<Record<string, PlanetId>>;
  readonly payment: PaymentPlan | null;
}

/** Diplomatie primär: das gewählte System; `null`, wenn es keines gibt. */
export interface SystemPlan {
  readonly kind: 'system';
  readonly system: SystemId | null;
}

/** Infrastruktur: die vorgemerkten Gebäude in ihrer Reihenfolge. */
export interface ConstructionPlan {
  readonly kind: 'construction';
  readonly placements: readonly StructurePlacement[];
}

/** Entscheidungen ohne Entwurf, nur mit Siegel (z. B. die taktische Aktion beenden). */
export interface DonePlan {
  readonly kind: 'done';
}

/** Ablegen über dem Limit: die gewählten Aktionskarten, je Exemplar ein Eintrag. */
export interface DiscardPlan {
  readonly kind: 'discard';
  readonly cards: readonly ActionCardId[];
}

/** Politik (neuer Sprecher) und Handel (Freibriefe): die gewählten Mitspieler. */
export interface PlayersPlan {
  readonly kind: 'players';
  readonly players: readonly PlayerId[];
}

/**
 * Werft (taktische Produktion, Kriegsführung sekundär): bestellte Einheiten je Art, der Planet
 * neuer Bodentruppen und die Bezahlung in Ressourcen.
 */
export interface ProductionPlan {
  readonly kind: 'production';
  /** Wo gebaut wird: aktiviertes System bzw. Heimatsystem; `null`, wenn es keines gibt. */
  readonly system: SystemId | null;
  readonly orders: Readonly<Record<string, number>>;
  /** Ausdrücklich gewählter Planet für Bodentruppen; `null` heißt: der erste mögliche. */
  readonly groundPlanet: PlanetId | null;
  readonly payment: PaymentPlan;
}

/** Forschungsauslage: gewählte Technologien, genutzte Spezialisierungen und die Bezahlung. */
export interface ResearchPlan {
  readonly kind: 'research';
  readonly technologies: readonly TechnologyId[];
  readonly specialties: readonly PlanetId[];
  readonly payment: PaymentPlan;
}

export type TableDraft =
  | TokenPlan
  | ObjectivePlan
  | ReadyPlan
  | PlacementPlan
  | SystemPlan
  | ConstructionPlan
  | DonePlan
  | DiscardPlan
  | PlayersPlan
  | ProductionPlan
  | ResearchPlan;

export type TableAction =
  | { readonly kind: 'move'; readonly from: DraftZone; readonly to: DraftZone }
  | { readonly kind: 'system'; readonly system: SystemId }
  | { readonly kind: 'tradeGoods'; readonly delta: 1 | -1 }
  | { readonly kind: 'planet'; readonly planet: PlanetId }
  | { readonly kind: 'objective'; readonly objective: ObjectiveId | null }
  /** Einen Planeten als Ziel antippen: nächste Figur zuweisen bzw. Gebäude setzen oder nehmen. */
  | { readonly kind: 'site'; readonly planet: PlanetId }
  /** Eine Figur einem Planeten zuweisen; `null` lässt sie im Weltraum. */
  | { readonly kind: 'assign'; readonly unit: UnitId; readonly planet: PlanetId | null }
  | { readonly kind: 'place'; readonly type: UnitTypeId; readonly planet: PlanetId }
  | { readonly kind: 'unplace'; readonly index: number }
  /** Eine Aktionskarte der Hand antippen: zum Ablegen vormerken oder zurücknehmen. */
  | { readonly kind: 'card'; readonly card: ActionCardId }
  /** Einen Mitspieler antippen oder den Sprechermarker auf sein Bild legen. */
  | { readonly kind: 'player'; readonly player: PlayerId }
  /** Eine Einheit der Werft bestellen (+1) oder zurücknehmen (−1); mit Planet für Bodentruppen. */
  | {
      readonly kind: 'order';
      readonly type: UnitTypeId;
      readonly delta: 1 | -1;
      readonly planet: PlanetId | null;
    }
  /** Eine Technologie der Auslage wählen oder zurücklegen. */
  | { readonly kind: 'technology'; readonly technology: TechnologyId }
  /** Einen Planeten mit Spezialisierung als Ersatz einer Voraussetzung nutzen oder nicht. */
  | { readonly kind: 'specialty'; readonly planet: PlanetId };

/** Ein Stück der Entscheidung auf dem Tisch: Figur oder Gebäude, und wo es gerade steht. */
export interface TablePiece {
  readonly ref: TargetRef;
  readonly type: UnitTypeId;
  readonly owner: PlayerId;
  /** Zugewiesener Planet; `null` im Weltraum bzw. noch im Bauvorrat. */
  readonly at: PlanetId | null;
}

/** Ein Marker, der mit dem Siegel in ein System käme (Vorschau als Geist). */
export interface GhostToken {
  readonly system: SystemId;
  readonly player: PlayerId;
}

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
  /** Figuren und Gebäude, die die Entscheidung auf den Tisch legt. */
  readonly pieces?: (ctx: SpecContext, draft: D) => readonly TablePiece[];
  /** Marker, die das Siegel in Systeme legen würde. */
  readonly ghosts?: (ctx: SpecContext, draft: D) => readonly GhostToken[];
  /** Erlaubte Zielschlüssel eines aufgenommenen Stücks dieser Entscheidung. */
  readonly legal?: (ctx: SpecContext, draft: D, piece: TargetRef) => ReadonlySet<string>;
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

/** Die freiwilligen Teile einer Entscheidung, auf den gemeinsamen Entwurf umgestellt. */
function optionalParts<D extends TableDraft>(
  spec: TableSpec<D, TableAction>,
  own: (ctx: SpecContext, draft: TableDraft) => D,
): Pick<AnySpec, 'alternative' | 'planets' | 'pieces' | 'ghosts' | 'legal'> {
  const { alternative, planets, pieces, ghosts, legal } = spec;
  return {
    ...(alternative && { alternative: (ctx, draft) => alternative(ctx, own(ctx, draft)) }),
    ...(planets && { planets: (ctx, draft) => planets(ctx, own(ctx, draft)) }),
    ...(pieces && { pieces: (ctx, draft) => pieces(ctx, own(ctx, draft)) }),
    ...(ghosts && { ghosts: (ctx, draft) => ghosts(ctx, own(ctx, draft)) }),
    ...(legal && { legal: (ctx, draft, piece) => legal(ctx, own(ctx, draft), piece) }),
  };
}

/** Macht eine Entscheidung mit eigenem Entwurf zu einem Eintrag der gemeinsamen Liste. */
export function widenSpec<K extends TableDraft['kind']>(
  spec: TableSpec<DraftOf<K>, TableAction>,
  kind: K,
): AnySpec {
  const own = (ctx: SpecContext, draft: TableDraft) => narrowed(spec, kind, ctx, draft);
  const { id, hint, initial } = spec;
  return {
    id,
    hint,
    initial,
    apply: (ctx, draft, action) => spec.apply(ctx, own(ctx, draft), action),
    targets: (ctx, draft) => spec.targets(ctx, own(ctx, draft)),
    progress: (ctx, draft) => spec.progress(ctx, own(ctx, draft)),
    confirm: (ctx, draft) => spec.confirm(ctx, own(ctx, draft)),
    command: (ctx, draft) => spec.command(ctx, own(ctx, draft)),
    ...optionalParts(spec, own),
  };
}
