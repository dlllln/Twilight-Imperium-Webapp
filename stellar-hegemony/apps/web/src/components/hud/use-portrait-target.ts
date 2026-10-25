import type { GameState, PlayerId } from '@stellar/domain';
import type { KeyboardEvent } from 'react';
import { useCarryStore } from '../../table/carry-store.ts';
import {
  type DropHandler,
  parseTargetKey,
  playerTarget,
  targetKey,
} from '../../table/target-ref.ts';
import { useDropRouter } from '../../table/use-drop-router.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { type TargetProps, useTarget } from '../../table/use-target.ts';

/*
 * Die Porträts als Ziele am Tisch: Bei der Politik sind sie eine Radiogruppe „Neuer Sprecher“,
 * auf die der Sprechermarker gelegt wird; beim Handel schalten sie den Freibrief eines
 * Mitspielers, bei einer Wahl auf dem Agendatisch wählen sie die Platte des Spielers. Sonst öffnen sie wie bisher die Übersicht. Wird etwas getragen (Sprechermarker
 * oder eine Aktionskarte aus der Hand), nimmt jedes Porträt mit erlaubtem Schlüssel es an.
 */

/** Wofür die Porträts gerade stehen; `null` heißt: wie bisher die Übersicht öffnen. */
export type PortraitMode = 'politics' | 'trade' | 'vote' | null;

/** Einmal je Leiste ermittelt und an alle Porträts gereicht. */
export interface PortraitTable {
  readonly decision: TableDecision | null;
  readonly router: DropHandler;
  readonly mode: PortraitMode;
}

/** Was der Knopf eines Porträts trägt: Ziel, Rolle in der Gruppe, Klick und Tasten. */
export interface PortraitButton {
  readonly props: Omit<TargetProps, 'onClick' | 'onKeyDown'> & {
    readonly role?: 'radio';
    readonly id?: string;
    readonly tabIndex?: 0 | -1;
    readonly 'aria-checked'?: boolean;
    readonly 'aria-pressed'?: boolean;
    readonly onClick: () => void;
    readonly onKeyDown?: (event: KeyboardEvent) => void;
  };
  /** Gewählt: neuer Sprecher (Geistmarker) bzw. Freibrief (Band). */
  readonly chosen: boolean;
  readonly mode: PortraitMode;
}

/** Eine Abstimmung nimmt die Porträts nur bei einer Wahl (dann führt sie Spieler als Ziele). */
function modeOf(decision: TableDecision | null): PortraitMode {
  const id = decision?.specId ?? null;
  if (id === 'vote') return offeredPlayers(decision).length > 0 ? 'vote' : null;
  return id === 'politics' || id === 'trade' ? id : null;
}

export function usePortraitTable(game: GameState): PortraitTable {
  const decision = useTableDecision(game);
  const router = useDropRouter(game);
  return { decision, router, mode: modeOf(decision) };
}

/** Die Mitspieler, die die Entscheidung anbietet, in der Reihenfolge der Leiste. */
function offeredPlayers(decision: TableDecision | null): readonly PlayerId[] {
  const keys = [...(decision?.targets.keys() ?? [])];
  return keys.flatMap((key) => {
    const ref = parseTargetKey(key);
    return ref?.kind === 'player' ? [ref.id] : [];
  });
}

/** Kennung des Radioknopfs eines Porträts; die Gruppe „Neuer Sprecher“ nennt sie in `aria-owns`. */
export const radioId = (id: PlayerId): string => `portrait-radio-${id}`;

/** Die Kennungen aller Radioknöpfe der Politik, in der Reihenfolge der Leiste. */
export const radioIds = (table: PortraitTable): string =>
  table.mode === 'politics' ? offeredPlayers(table.decision).map(radioId).join(' ') : '';

const ARROWS: Readonly<Record<string, 1 | -1>> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

/** Pfeiltasten in der Radiogruppe: nächsten Kandidaten wählen und den Fokus mitnehmen. */
function arrowKey(table: PortraitTable, id: PlayerId, event: KeyboardEvent): void {
  const step = ARROWS[event.key];
  const ring = offeredPlayers(table.decision);
  if (step === undefined || ring.length === 0) return;
  // Die Pfeile gehören der Gruppe; die Kamera am Fenster soll sie nicht auch noch sehen.
  event.preventDefault();
  event.stopPropagation();
  const next = ring[(ring.indexOf(id) + step + ring.length) % ring.length] ?? id;
  table.decision?.act({ kind: 'player', player: next });
  const key = targetKey(playerTarget(next));
  document.querySelector<HTMLElement>(`button[data-target="${key}"]`)?.focus();
}

/**
 * Ein einziger Tab-Halt in der Radiogruppe: der gewählte Kandidat, ohne Wahl der erste. Trägt
 * man den Marker, bleiben alle erlaubten Porträts per Tab erreichbar (Enter legt dort ab).
 */
function tabStop(table: PortraitTable, id: PlayerId, chosen: boolean): 0 | -1 {
  const anyChosen = [...(table.decision?.targets.values() ?? [])].includes('chosen');
  const stop = anyChosen ? chosen : offeredPlayers(table.decision)[0] === id;
  return stop ? 0 : -1;
}

/** Rolle des Knopfs: Radioknopf (Politik) oder Schalter (Handel), nur für angebotene Spieler. */
function roleOf(table: PortraitTable, id: PlayerId, chosen: boolean, carrying: boolean) {
  if (table.mode === 'trade' || table.mode === 'vote') return { 'aria-pressed': chosen };
  if (table.mode !== 'politics') return {};
  const radio = { role: 'radio' as const, id: radioId(id), 'aria-checked': chosen };
  return carrying ? radio : { ...radio, tabIndex: tabStop(table, id, chosen) };
}

/** Klick und Tasten ohne getragenes Stück: wählen bzw. umschalten, sonst die Übersicht. */
function ownHandlers(table: PortraitTable, id: PlayerId, offered: boolean, open: () => void) {
  if (table.mode === null || !offered) return { onClick: open };
  const pick = () => table.decision?.act({ kind: 'player', player: id });
  if (table.mode !== 'politics') return { onClick: pick };
  return { onClick: pick, onKeyDown: (event: KeyboardEvent) => arrowKey(table, id, event) };
}

/** Knopf eines Porträts; beim Tragen übernehmen die Ablage-Handler des Ziels Klick und Enter. */
export function usePortraitTarget(
  table: PortraitTable,
  id: PlayerId,
  open: () => void,
): PortraitButton {
  const ref = playerTarget(id);
  const decided = table.decision?.targets.get(targetKey(ref));
  const target = useTarget(ref, decided, table.router);
  const carrying = useCarryStore((state) => state.piece !== null);
  const offered = table.mode !== null && decided !== undefined;
  const chosen = decided === 'chosen';
  const { onClick, onKeyDown, ...marks } = target.props;
  const own = ownHandlers(table, id, offered, open);
  const dropping = carrying && onClick !== undefined;
  const handlers = dropping ? { onClick, ...(onKeyDown !== undefined && { onKeyDown }) } : own;
  const role = offered ? roleOf(table, id, chosen, carrying) : {};
  return { props: { ...marks, ...role, ...handlers }, chosen: offered && chosen, mode: table.mode };
}
