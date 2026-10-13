import type { GameEvent, PlayerId } from '@stellar/domain';

/*
 * Zugverlauf „Was ist passiert?“ (reine Funktionen): Aus den Events, die der Server schickt,
 * werden kurze Zeilen – wer hat was aktiviert, bewegt, erobert. Gespeichert werden Daten,
 * kein Text; die Zeile wird erst beim Anzeigen in der gewählten Sprache formuliert.
 */

export type HistoryLine =
  | { readonly kind: 'round'; readonly round: number }
  | { readonly kind: 'activated'; readonly player: PlayerId; readonly system: string }
  | {
      readonly kind: 'moved';
      readonly player: PlayerId;
      readonly system: string;
      readonly count: number;
    }
  | {
      readonly kind: 'produced';
      readonly player: PlayerId;
      readonly system: string;
      readonly count: number;
    }
  | { readonly kind: 'conquered'; readonly player: PlayerId; readonly planet: string }
  | {
      readonly kind: 'spaceCombat';
      readonly player: PlayerId;
      readonly rival: PlayerId;
      readonly system: string;
    }
  | { readonly kind: 'picked'; readonly player: PlayerId; readonly card: string }
  | { readonly kind: 'strategic'; readonly player: PlayerId; readonly card: string }
  | { readonly kind: 'researched'; readonly player: PlayerId; readonly technology: string }
  | { readonly kind: 'scored'; readonly player: PlayerId; readonly objective: string }
  | { readonly kind: 'traded'; readonly player: PlayerId; readonly rival: PlayerId }
  | { readonly kind: 'passed'; readonly player: PlayerId }
  | { readonly kind: 'undone'; readonly player: PlayerId }
  | { readonly kind: 'won'; readonly player: PlayerId };

export interface HistoryEntry {
  readonly id: number;
  readonly line: HistoryLine;
}

/** So viele Zeilen behält der Verlauf; ältere fallen heraus. */
export const HISTORY_LIMIT = 80;

type Describers = {
  readonly [K in GameEvent['type']]?: (event: Extract<GameEvent, { type: K }>) => HistoryLine;
};

const DESCRIBE: Describers = {
  StrategyPhaseStarted: ({ round }) => ({ kind: 'round', round }),
  SystemActivated: ({ player, system }) => ({ kind: 'activated', player, system }),
  ShipsMoved: ({ player, system, movements }) => ({
    kind: 'moved',
    player,
    system,
    count: movements.length,
  }),
  UnitsProduced: ({ player, system, space, ground }) => ({
    kind: 'produced',
    player,
    system,
    count: space.length + ground.length,
  }),
  PlanetControlGained: ({ player, planet }) => ({ kind: 'conquered', player, planet }),
  SpaceCombatStarted: ({ attacker, defender, system }) => ({
    kind: 'spaceCombat',
    player: attacker,
    rival: defender,
    system,
  }),
  StrategyCardPicked: ({ player, card }) => ({ kind: 'picked', player, card }),
  StrategicActionPerformed: ({ player, card }) => ({ kind: 'strategic', player, card }),
  TechnologyResearched: ({ player, technology }) => ({ kind: 'researched', player, technology }),
  ObjectiveScored: ({ player, objective }) => ({ kind: 'scored', player, objective }),
  TransactionCompleted: ({ from, to }) => ({ kind: 'traded', player: from, rival: to }),
  PlayerPassed: ({ player }) => ({ kind: 'passed', player }),
  StepUndone: ({ player }) => ({ kind: 'undone', player }),
  GameWon: ({ player }) => ({ kind: 'won', player }),
};

function describe(event: GameEvent): HistoryLine | null {
  const describer = DESCRIBE[event.type] as ((known: GameEvent) => HistoryLine) | undefined;
  return describer === undefined ? null : describer(event);
}

/** Die erzählenswerten Events als Zeilen; Würfe, Marker und Zwischenschritte bleiben weg. */
export const historyLines = (events: readonly GameEvent[]): readonly HistoryLine[] =>
  events.flatMap((event) => describe(event) ?? []);

/** Hängt die neuen Zeilen an, mit fortlaufender Nummer, und behält nur die letzten. */
export function appendHistory(
  history: readonly HistoryEntry[],
  events: readonly GameEvent[],
): readonly HistoryEntry[] {
  const start = (history.at(-1)?.id ?? 0) + 1;
  const added = historyLines(events).map((line, index) => ({ id: start + index, line }));
  return added.length === 0 ? history : [...history, ...added].slice(-HISTORY_LIMIT);
}
