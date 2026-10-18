import type { GameState } from '@stellar/domain';
import { useGameStore } from '../game-store.ts';
import { useHandStore } from '../hand/hand-store.ts';
import type { MessageKey } from '../i18n.ts';
import { useSettingsStore } from '../settings-store.ts';
import { content } from '../store.ts';
import { useCarryStore } from './carry-store.ts';
import type { DecisionRoute } from './decision-route.ts';
import { useDraftStore } from './draft-store.ts';
import {
  type PoolSpec,
  type Progress,
  type SpecContext,
  TABLE_SPECS,
  type TableAction,
  type TableDraft,
  type TableSpecId,
  tableSpecOf,
} from './table-specs.ts';
import type { TargetState } from './target-ref.ts';
import { useDecisionRoute } from './use-decision-route.ts';

/*
 * Die offene Entscheidung samt Entwurf, wie Ansage, Pult und Karte sie brauchen. Der Entwurf
 * entsteht beim Zeichnen aus `spec.initial` und landet erst mit der ersten Handlung im Store.
 * Nur die Tischansicht spielt Entscheidungen am Tisch; die klassische Ansicht behält ihre
 * Formulare, dort bleiben Karte und Pult ohne Entwurf.
 */

export interface TableAlternative {
  readonly label: MessageKey;
  readonly run: () => void;
}

export interface TableDecision {
  readonly route: DecisionRoute;
  readonly specId: TableSpecId | null;
  readonly draft: TableDraft | null;
  readonly targets: ReadonlyMap<string, TargetState>;
  readonly progress: Progress | null;
  readonly hint: MessageKey | null;
  readonly confirmLabel: MessageKey | null;
  readonly act: (action: TableAction) => void;
  readonly confirm: () => void;
  readonly alternative: TableAlternative | null;
}

const NO_TARGETS: ReadonlyMap<string, TargetState> = new Map();

/** Hinweise für Entscheidungen ohne Tischentwurf. */
const ROUTE_HINTS: Partial<Record<DecisionRoute['kind'], MessageKey>> = {
  idle: 'tableHintActivate',
  combat: 'combatWaiting',
};

interface Ported {
  readonly spec: PoolSpec;
  readonly ctx: SpecContext;
  readonly key: string;
}

function portedOf(game: GameState, route: DecisionRoute | null): Ported | null {
  const id = route === null ? null : tableSpecOf(route, content);
  if (route === null || id === null || route.actor === null) return null;
  const ctx = { game, actor: route.actor, route };
  return { spec: TABLE_SPECS[id], ctx, key: `${route.key}@${String(game.version)}` };
}

/** Der gültige Entwurf: aus dem Store, wenn sein Schlüssel passt, sonst frisch. */
function currentDraft(ported: Ported): TableDraft {
  const { key, draft } = useDraftStore.getState();
  return key === ported.key && draft !== null ? draft : ported.spec.initial(ported.ctx);
}

function actOn(ported: Ported, action: TableAction): void {
  const store = useDraftStore.getState();
  const next = ported.spec.apply(ported.ctx, currentDraft(ported), action);
  if (store.key === ported.key) store.update(next);
  else store.begin(ported.key, next);
}

/** Abgeschickt und weder abgelöst noch abgelehnt: das Siegel bleibt gesperrt. */
const pendingNow = (key: string): boolean =>
  useDraftStore.getState().sent === key && useGameStore.getState().error === null;

/**
 * Schickt den fertigen Entwurf als genau einen Command. Der Entwurf bleibt liegen, bis der neue
 * Spielstand ihn über den Schlüssel ablöst; lehnt der Server ab, ist er noch da.
 */
function confirmOf(ported: Ported): void {
  const draft = currentDraft(ported);
  if (!ported.spec.progress(ported.ctx, draft).ready || pendingNow(ported.key)) return;
  const store = useGameStore.getState();
  store.setError(null);
  if (!store.send(ported.spec.command(ported.ctx, draft))) return;
  useDraftStore.getState().markSent(ported.key);
  if (ported.ctx.route.kind === 'primary') useHandStore.getState().clear();
}

function alternativeOf(ported: Ported): TableAlternative | null {
  const { route, actor } = ported.ctx;
  if (route.kind === 'secondary')
    return {
      label: 'decline',
      run: () => useGameStore.getState().send({ type: 'DeclineSecondary', issuedBy: actor }),
    };
  if (route.kind !== 'primary') return null;
  const cancel = () => {
    useDraftStore.getState().clear();
    useHandStore.getState().clear();
  };
  return { label: 'cancel', run: cancel };
}

const idle = (route: DecisionRoute): TableDecision => ({
  route,
  specId: null,
  draft: null,
  targets: NO_TARGETS,
  progress: null,
  hint: ROUTE_HINTS[route.kind] ?? null,
  confirmLabel: null,
  act: () => undefined,
  confirm: () => undefined,
  alternative: null,
});

/** Was der Store zum Entwurf weiß; `failed`, solange eine Ablehnung angezeigt wird. */
interface Stored {
  readonly key: string | null;
  readonly draft: TableDraft | null;
  readonly sent: string | null;
  readonly failed: boolean;
}

function useStored(): Stored {
  const key = useDraftStore((state) => state.key);
  const draft = useDraftStore((state) => state.draft);
  const sent = useDraftStore((state) => state.sent);
  const failed = useGameStore((state) => state.error !== null);
  return { key, draft, sent, failed };
}

/** Fortschritt des Entwurfs; ein abgeschickter Entwurf ist nicht noch einmal bereit. */
function progressOf(ported: Ported, draft: TableDraft, stored: Stored): Progress {
  const progress = ported.spec.progress(ported.ctx, draft);
  const pending = stored.sent === ported.key && !stored.failed;
  return pending ? { ...progress, ready: false } : progress;
}

function decisionWith(ported: Ported, stored: Stored): TableDecision {
  const { spec, ctx } = ported;
  const draft = (stored.key === ported.key ? stored.draft : null) ?? spec.initial(ctx);
  return {
    route: ctx.route,
    specId: spec.id,
    draft,
    targets: spec.targets(ctx, draft),
    progress: progressOf(ported, draft, stored),
    hint: spec.hint,
    confirmLabel: spec.confirm(ctx, draft),
    act: (action) => {
      actOn(ported, action);
    },
    confirm: () => {
      confirmOf(ported);
    },
    alternative: alternativeOf(ported),
  };
}

/** Die offene Entscheidung am Bildschirm; `null` genau dann, wenn es keine Route gibt. */
export function useTableDecision(game: GameState | null): TableDecision | null {
  const route = useDecisionRoute(game);
  const table = useSettingsStore((state) => state.tableView);
  const stored = useStored();
  if (game === null || route === null) return null;
  const ported = table ? portedOf(game, route) : null;
  return ported === null ? idle(route) : decisionWith(ported, stored);
}

/** Ziele der Entscheidung, dazu alle erlaubten Ziele des getragenen Stücks. */
export function useTableTargets(game: GameState | null): ReadonlyMap<string, TargetState> {
  const decision = useTableDecision(game);
  const legal = useCarryStore((state) => state.legal);
  const base = decision?.targets ?? NO_TARGETS;
  if (legal.size === 0) return base;
  const merged = new Map(base);
  for (const key of legal) if (!merged.has(key)) merged.set(key, 'legal');
  return merged;
}
