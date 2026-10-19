import { findPlayer, type GameState } from '@stellar/domain';
import { type ReactElement, type ReactNode, useEffect } from 'react';
import { entryKey, type HandEntry, needsLift } from '../../hand/hand-model.ts';
import { liftStep, useLiftStore } from '../../hand/lift-store.ts';
import type { MessageKey } from '../../i18n.ts';
import { useViewer } from '../../game-store.ts';
import { seatColor } from '../../seat-colors.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { type HandMode, handModeOf } from '../../table/hand-modes.ts';
import { discardCount } from '../../table/spec-discard.ts';
import type { DropHandler } from '../../table/target-ref.ts';
import { useDropRouter } from '../../table/use-drop-router.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { useT } from '../../use-translation.ts';

/*
 * Die Hand am Tisch: Je nach offener Entscheidung spielt sie aus, merkt Karten zum Ablegen vor
 * (rotes Band) oder lässt im Reaktionsfenster die spielbaren Karten leuchten. Karten vor dem
 * eigenen Platz (Relikte, Fragmente, legendäre Planeten, Anführer ohne Originalkarte) heben sich
 * beim ersten Antippen und wirken erst beim zweiten; Hochziehen spielt sie weiterhin direkt.
 */

export interface HandTable {
  readonly mode: HandMode;
  readonly decision: TableDecision | null;
  /** Führt ein Ablegen am Tisch aus (Aktionskarte auf ein Ziel). */
  readonly router: DropHandler;
  /** Nur in der Tischansicht lassen sich Karten mit Zielen auf den Tisch ziehen. */
  readonly carry: boolean;
  /** Platzfarbe des Betrachters für den Schein spielbarer Karten; ohne Platz keine. */
  readonly seat: string | null;
}

type Translate = (key: MessageKey) => string;

type Attributes = Readonly<Record<string, string | number | boolean | undefined>>;

/** Was eine Karte je nach Art der Hand trägt und was Antippen und Hochziehen bewirken. */
export interface CardMarks {
  readonly attributes: Attributes;
  /** Antippen: ausspielen, zum Ablegen vormerken oder anheben. */
  readonly tap: () => void;
  /** Hochziehen spielt direkt aus; `null`, solange die Hand nicht ausspielt. */
  readonly flick: (() => void) | null;
  /** Antippen spielt die Karte (sonst wirkt es nur, wenn es etwas vormerkt). */
  readonly plays: boolean;
  /** Antippen wirkt auch bei einer gerade nicht spielbaren Karte (Ablegen). */
  readonly toggles: boolean;
  readonly lifted: boolean;
  readonly children: ReactNode;
}

const lower = (): void => {
  useLiftStore.getState().lower();
};

/** Ob der Fokus in der Hand liegt (und nicht in einem Dialog, Menü oder einer Vorschau). */
const focusInHand = (): boolean => (document.activeElement?.closest('.hand-dock') ?? null) !== null;

/**
 * Escape senkt die angehobene Karte. Nur wenn der Fokus in der Hand liegt, gehört die Taste ihr
 * allein und erreicht andere Tastenhörer (z. B. die Kamera) nicht; sonst schließt dieselbe Taste
 * weiter, was gerade offen ist.
 */
function escapeLifted(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || useLiftStore.getState().lifted === null) return;
  lower();
  if (focusInHand()) event.stopPropagation();
}

/** Ein neuer Spielstand und Escape senken die angehobene Karte. */
function useLiftReset(version: number): void {
  useEffect(lower, [version]);
  useEffect(() => {
    window.addEventListener('keydown', escapeLifted, true);
    return () => {
      window.removeEventListener('keydown', escapeLifted, true);
    };
  }, []);
}

/** Die Art der Hand zur offenen Entscheidung samt Ablage für gezogene Karten. */
export function useHandTable(game: GameState): HandTable {
  const decision = useTableDecision(game);
  const router = useDropRouter(game);
  const carry = useSettingsStore((state) => state.tableView);
  const viewer = useViewer();
  useLiftReset(game.version);
  const player = viewer === null ? undefined : findPlayer(game, viewer);
  const seat = player === undefined ? null : seatColor(player.seat + 1);
  return { mode: handModeOf(decision), decision, router, carry, seat };
}

/** Rotes Band über einer zum Ablegen vorgemerkten Karte; „×n“ bei mehreren Exemplaren. */
export function DiscardRibbon(props: {
  readonly count: number;
  readonly label: string;
}): ReactElement {
  const { count, label } = props;
  return (
    <span className="hand-discard-ribbon">
      {label}
      {count > 1 && ` ×${String(count)}`}
    </span>
  );
}

const QUIET = { flick: null, plays: false, toggles: false, lifted: false, children: null };

/** Ablegen: Aktionskarten werden zu Schaltern, alles andere ruht (Karten nur zur Ansicht). */
function discardMarks(
  entry: HandEntry,
  decision: TableDecision | null,
  t: Translate,
  onPlay: () => void,
): CardMarks {
  if (entry.kind !== 'action') return { ...QUIET, attributes: {}, tap: onPlay };
  const card = entry.card.definition.id;
  const count = discardCount(decision?.draft ?? null, card);
  return {
    ...QUIET,
    attributes: { 'aria-pressed': count > 0, 'data-discard': count, title: t('discardTap') },
    tap: () => decision?.act({ kind: 'card', card }),
    toggles: true,
    children: count > 0 && <DiscardRibbon count={count} label={t('discardRibbon')} />,
  };
}

/** Zwei Schritte: anheben, dann ausspielen; Hochziehen spielt sofort. */
function liftMarks(entry: HandEntry, lifted: boolean, t: Translate, onPlay: () => void) {
  const key = entryKey(entry);
  const play = () => {
    lower();
    onPlay();
  };
  const tap = () => {
    if (liftStep(useLiftStore.getState().lifted, key) === 'play') play();
    else useLiftStore.getState().lift(key);
  };
  const attributes = {
    'data-lifted': lifted ? 'true' : undefined,
    'aria-pressed': lifted,
    'aria-description': lifted ? t('liftToPlay') : undefined,
    ...(entry.playable ? { title: t(lifted ? 'liftToPlay' : 'liftFirst') } : {}),
  };
  return { ...QUIET, attributes, tap, flick: play, plays: true, lifted };
}

/** Im Reaktionsfenster leuchten die Aktionskarten, die jetzt gespielt werden dürfen. */
const reactionAttributes = (entry: HandEntry, mode: HandMode, t: Translate): Attributes =>
  mode === 'reaction' && entry.kind === 'action' && entry.playable
    ? { 'data-reaction': 'ready', title: t('reactionReady') }
    : {};

/** Übliches Ausspielen; ein Antippen senkt zugleich eine andere, angehobene Karte. */
function playMarks(entry: HandEntry, mode: HandMode, t: Translate, onPlay: () => void) {
  const tap = () => {
    lower();
    onPlay();
  };
  return {
    ...QUIET,
    attributes: reactionAttributes(entry, mode, t),
    tap,
    flick: onPlay,
    plays: true,
  };
}

export function useCardMarks(entry: HandEntry, hand: HandTable, onPlay: () => void): CardMarks {
  const t = useT();
  const lifted = useLiftStore((state) => state.lifted === entryKey(entry));
  if (hand.mode === 'discard') return discardMarks(entry, hand.decision, t, onPlay);
  if (needsLift(entry)) return liftMarks(entry, lifted, t, onPlay);
  return playMarks(entry, hand.mode, t, onPlay);
}

/** Ob die Karte gerade etwas tut: vormerken, ansehen oder ausspielen. */
export function cardAvailability(
  entry: HandEntry,
  marks: CardMarks,
  inspect: boolean,
  present: boolean,
): { readonly active: boolean; readonly disabled: boolean } {
  const usable = marks.toggles || inspect || (entry.playable && marks.plays);
  return { active: usable && present, disabled: !usable };
}
