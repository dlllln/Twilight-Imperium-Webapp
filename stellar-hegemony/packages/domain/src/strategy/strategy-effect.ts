import type { DecisionContext } from '../eventsourcing/command.ts';
import type { Payment } from '../economy/payment.ts';
import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import type { PoolCounts } from '../player/command-sheet.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import type { PlanetId, PlayerId, SystemId, TechnologyId, UnitTypeId } from '../shared/ids.ts';
import type { ProductionRequest } from '../production/production.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { StrategyCardDefinition, StrategyMechanic } from './strategy-card.ts';

/** Entscheidungen des Spielers für die Mechanik „Kommandomarker gewinnen“. */
export interface CommandTokensChoice {
  readonly mechanic: 'commandTokens';
  readonly influence: Payment;
  readonly allocation: PoolCounts;
}

/**
 * Entscheidungen für „Diplomatie“: Primär ein System (außer dem Zentrum),
 * sekundär bis zu zwei erschöpfte eigene Planeten.
 */
export interface DiplomacyChoice {
  readonly mechanic: 'diplomacy';
  readonly system: SystemId | null;
  readonly planets: readonly PlanetId[];
}

export interface StructurePlacement {
  readonly type: UnitTypeId;
  readonly planet: PlanetId;
}

/**
 * „Bauen“: primär ein Gebäude und optional ein weiteres mit Weltraumkanone;
 * sekundär ein Gebäude in `system`, wohin ein Marker aus dem Nachschub kommt.
 */
export interface ConstructionChoice {
  readonly mechanic: 'construction';
  readonly placements: readonly StructurePlacement[];
  readonly system: SystemId | null;
}

/** „Handel“: wer die Sekundärfähigkeit ohne Strategiemarker nutzen darf. */
export interface TradeChoice {
  readonly mechanic: 'trade';
  readonly freeFor: readonly PlayerId[];
}

/** „Kriegsführung“: primär Marker zurücknehmen und neu verteilen, sekundär produzieren. */
export interface WarfareChoice {
  readonly mechanic: 'warfare';
  readonly system: SystemId | null;
  readonly pools: PoolCounts;
  readonly production: ProductionRequest | null;
}

/**
 * „Technologie“: primär eine Technologie und optional eine zweite gegen Ressourcen,
 * sekundär eine gegen Ressourcen. Spezialisierungen ersetzen Voraussetzungen.
 */
export interface TechnologyChoice {
  readonly mechanic: 'technology';
  readonly technologies: readonly TechnologyId[];
  readonly specialties: readonly PlanetId[];
  readonly payment: Payment;
}

/** Jede Mechanik ergänzt hier ihre Auswahl-Struktur. */
export type StrategyChoice =
  | CommandTokensChoice
  | DiplomacyChoice
  | ConstructionChoice
  | TradeChoice
  | WarfareChoice
  | TechnologyChoice;

export interface EffectInput {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly choice: StrategyChoice;
  readonly context: DecisionContext;
}

/** Strategy Pattern: Primär- und Sekundärfähigkeit einer Mechanik. */
export interface StrategyEffect {
  readonly mechanic: StrategyMechanic;
  primary(input: EffectInput): Result<readonly GameEvent[], DomainError>;
  secondary(input: EffectInput): Result<readonly GameEvent[], DomainError>;
}

/** Prüft, ob die Auswahl zur Mechanik der Karte passt, und verengt ihren Typ. */
export function choiceOf<M extends StrategyChoice['mechanic']>(
  input: EffectInput,
  mechanic: M,
): Result<Extract<StrategyChoice, { mechanic: M }>, DomainError> {
  const { choice } = input;
  return choice.mechanic === mechanic
    ? ok(choice as Extract<StrategyChoice, { mechanic: M }>)
    : err(domainError('strategy.choiceMismatch', 'Auswahl passt nicht zur Karte', { mechanic }));
}

/** Zahl aus den Kartenparametern; fehlt sie, ist das ein Fehler der Stammdaten. */
export function parameterOf(
  card: StrategyCardDefinition,
  name: string,
): Result<number, DomainError> {
  const value = card.parameters[name];
  return value === undefined
    ? err(domainError('strategy.parameter', `Parameter fehlt: ${name}`))
    : ok(value);
}
