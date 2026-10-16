import type { GameState } from '@stellar/domain';
import { useMemo, useRef } from 'react';
import { useGameStore, useViewer } from '../game-store.ts';
import { useSettingsStore } from '../settings-store.ts';
import { content } from '../store.ts';
import { useLegalFor } from '../table/carry-rules.ts';
import type { PoolDraft } from '../table/pool-draft.ts';
import type { DropHandler, TargetRef } from '../table/target-ref.ts';
import { useDropRouter } from '../table/use-drop-router.ts';
import { type TableDecision, useTableDecision } from '../table/use-table-decision.ts';
import { type SheetChanges, type SheetModel, sheetChanges, sheetModel } from './sheet-model.ts';
import {
  freshLedger,
  rebalance,
  type TokenLedger,
  ZONES,
  type ZoneCounts,
} from './token-ledger.ts';

/*
 * Hooks für das Kommandopult: Daten des eigenen Platzes, die Buchführung der Marker über die
 * Züge hinweg, die kurzen Änderungsanzeigen nach jedem Zug und die offene Tischentscheidung,
 * deren Entwurf die Leisten zeigen.
 */

/** Eine Änderungsanzeige; die laufende Nummer macht jede Anzeige eindeutig. */
export interface SheetPulse {
  readonly serial: number;
  readonly changes: SheetChanges;
}

const IDLE: SheetPulse = { serial: 0, changes: {} };

/** Das Pult des eigenen Platzes; null ohne eigenen Platz. */
export function useSheetModel(game: GameState): SheetModel | null {
  const viewer = useViewer();
  return useMemo(
    () => (viewer === null ? null : sheetModel(game, viewer, content)),
    [game, viewer],
  );
}

/** Marker behalten ihre Nummer über die Züge; nur Gewanderte wechseln das Feld. */
export function useTokenLedger(counts: ZoneCounts): TokenLedger {
  const previous = useRef<TokenLedger | null>(null);
  const key = ZONES.map((zone) => counts[zone]).join('/');
  return useMemo(() => {
    const prev = previous.current;
    const next = prev === null ? freshLedger(counts) : rebalance(prev, counts);
    previous.current = next;
    return next;
    // Der Schlüssel fasst die Anzahlen zusammen; ein neues, gleiches Objekt verteilt nicht neu.
  }, [key]);
}

/**
 * Laufende Nummer des Zugs, der schon zurücklag, als das Pult erschien oder die Animationen
 * angingen; seine Änderungen sind alt und werden nicht noch einmal angezeigt.
 */
function useSeenSerial(serial: number, animations: boolean): number {
  const seen = useRef(serial);
  const wasOn = useRef(animations);
  if (animations && !wasOn.current) seen.current = serial;
  wasOn.current = animations;
  return seen.current;
}

/** Was der letzte Zug am eigenen Pult geändert hat; ruhig ohne Animationen und für alte Züge. */
export function useSheetPulse(model: SheetModel | null): SheetPulse {
  const last = useGameStore((state) => state.lastEvents);
  const animations = useSettingsStore((state) => state.animations);
  const seen = useSeenSerial(last?.serial ?? 0, animations);
  return useMemo(() => {
    if (!animations || last === null || model === null || last.serial <= seen) return IDLE;
    const before = sheetModel(last.before, model.player, content);
    return before === null ? IDLE : { serial: last.serial, changes: sheetChanges(before, model) };
  }, [animations, last, model, seen]);
}

/** Was die Stücke und Ziele des Pults brauchen: Entscheidung, Ablage und erlaubte Ziele. */
export interface SheetTable {
  readonly decision: TableDecision | null;
  readonly router: DropHandler;
  readonly legalFor: (piece: TargetRef) => ReadonlySet<string>;
}

/** Die offene Entscheidung am Pult, einmal je Pult ermittelt und an alle Leisten gereicht. */
export function useSheetTable(game: GameState): SheetTable {
  const decision = useTableDecision(game);
  const router = useDropRouter(game);
  const legalFor = useLegalFor(game);
  return { decision, router, legalFor };
}

/** Läuft eine Markerverteilung, liefert sie den Entwurf der Leisten; sonst `null`. */
export const poolPlanOf = (table: SheetTable): PoolDraft | null =>
  table.decision?.draft?.pools ?? null;
