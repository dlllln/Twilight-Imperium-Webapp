import type { TableCue } from '../audio/table-cues.ts';
import type { PlanetMode } from './planet-table.ts';
import type { TableAction, TableSpecId } from './spec-types.ts';

/*
 * Welche Geste am Tisch welchen Klang trägt (reine Tabellen). Klänge folgen dem Entwurf, nicht
 * dem Server: Sie bestätigen die Hand, die gerade etwas gelegt hat.
 */

/** Handlungen am Entwurf mit eigenem Klang; alle übrigen bleiben still. */
const ACTION_CUES: Readonly<Partial<Record<TableAction['kind'], TableCue>>> = {
  move: 'token',
  tradeGoods: 'coin',
  peg: 'token',
  assign: 'token',
  place: 'token',
  order: 'token',
};

/** Siegel, die mit einem eigenen Klang schließen: Hammer bei Abstimmung, Stichentscheid, Sprecher. */
const CONFIRM_CUES: Readonly<Partial<Record<TableSpecId, TableCue>>> = {
  vote: 'gavel',
  tieBreak: 'gavel',
  politics: 'gavel',
  tokens: 'token',
};

/** Klang einer Handlung; Planeten klingen nach ihrer Richtung (`planetCue`). */
export const actionCue = (action: TableAction): TableCue | null => ACTION_CUES[action.kind] ?? null;

/** Klang des Siegels einer Entscheidung, sobald sie abgeschickt ist. */
export const confirmCue = (spec: TableSpecId): TableCue | null => CONFIRM_CUES[spec] ?? null;

/**
 * Ein Planet kippt quer (erschöpfen) oder richtet sich auf (bereitmachen): Beim Bezahlen kippt
 * ein neu vorgemerkter, beim Bereitmachen richtet er sich auf; Zurücknehmen klingt umgekehrt.
 */
export function planetCue(mode: PlanetMode, chosenBefore: boolean): TableCue {
  return (mode === 'pay') !== chosenBefore ? 'exhaust' : 'ready';
}
