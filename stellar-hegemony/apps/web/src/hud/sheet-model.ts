import {
  COMMAND_POOLS,
  type CommandPool,
  type ContentPort,
  type FactionId,
  findPlayer,
  type GameState,
  type PlayerId,
} from '@stellar/domain';
import { type EmpireSummary, empireSummary, type Supply } from './hud-model.ts';

/*
 * Daten für das Kommandopult vor dem eigenen Platz (reine Funktionen): Kommandomarker in den
 * Pools, im Nachschub und auf der Karte, dazu Schatzkammer und Siegpunkte.
 */

/** Felder des Pults, deren Inhalt sich zählen und als Änderung anzeigen lässt. */
export type SheetZone = CommandPool | 'reinforcements' | 'tradeGoods' | 'commodities';

/** Eine Leiste mit Fassungen: belegt, frei und was nicht mehr hineinpasst. */
export interface Rack {
  readonly filled: number;
  readonly empty: number;
  readonly overflow: number;
}

export interface SheetModel {
  readonly player: PlayerId;
  /** 1-basiert (Sitzplatz + 1), passend zur Sitzfarbe. */
  readonly seat: number;
  readonly faction: FactionId;
  readonly summary: EmpireSummary;
  /** Kommandomarker im persönlichen Nachschub. */
  readonly reinforcements: number;
  /** Systeme, in denen ein eigener Kommandomarker liegt. */
  readonly onBoard: number;
  readonly victoryGoal: number;
}

/** Änderungen gegenüber dem Stand davor; nur Felder, die sich wirklich geändert haben. */
export type SheetChanges = Readonly<Partial<Record<SheetZone | 'victoryPoints', number>>>;

export const RACK_MIN = 4;
export const RACK_MAX = 8;
export const PILE_MAX = 10;

/** Wie viele eigene Kommandomarker auf der Karte liegen. */
export function boardTokens(game: GameState, player: PlayerId): number {
  return Object.values(game.systems).filter((system) => system.commandTokens.includes(player))
    .length;
}

/** Alles, was das Pult für einen Spieler zeigt; null, wenn er nicht mitspielt. */
export function sheetModel(
  game: GameState,
  player: PlayerId,
  content: ContentPort,
): SheetModel | null {
  const state = findPlayer(game, player);
  const summary = empireSummary(game, player, content);
  if (state === undefined || summary === null) return null;
  return {
    player,
    seat: state.seat + 1,
    faction: state.faction,
    summary,
    reinforcements: state.reinforcementTokens,
    onBoard: boardTokens(game, player),
    victoryGoal: game.config.victoryPointsToWin,
  };
}

/** Verteilt eine Anzahl auf eine Leiste mit mindestens min und höchstens max Fassungen. */
export function rackOf(count: number, min = RACK_MIN, max = RACK_MAX): Rack {
  return {
    filled: Math.min(count, max),
    empty: Math.max(0, min - count),
    overflow: Math.max(0, count - max),
  };
}

/** Die gezählten Felder eines Pults. */
function zoneValues(model: SheetModel): Readonly<Record<SheetZone | 'victoryPoints', number>> {
  const { pools, tradeGoods, commodities, victoryPoints } = model.summary;
  return {
    ...pools,
    reinforcements: model.reinforcements,
    tradeGoods,
    commodities: commodities.ready,
    victoryPoints,
  };
}

const CHANGE_KEYS: readonly (SheetZone | 'victoryPoints')[] = [
  ...COMMAND_POOLS,
  'reinforcements',
  'tradeGoods',
  'commodities',
  'victoryPoints',
];

/** Was sich zwischen zwei Ständen geändert hat, z. B. +2 Handelswaren oder −1 Taktik. */
export function sheetChanges(before: SheetModel, after: SheetModel): SheetChanges {
  const old = zoneValues(before);
  const now = zoneValues(after);
  const entries = CHANGE_KEYS.map((key) => [key, now[key] - old[key]] as const);
  return Object.fromEntries(entries.filter(([, delta]) => delta !== 0));
}

/** Bereit / gesamt, z. B. „3/5“. */
export const supplyText = (supply: Supply): string => `${supply.ready}/${supply.total}`;
