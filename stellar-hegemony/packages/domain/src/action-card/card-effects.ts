import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import { COMMAND_POOLS } from '../player/command-sheet.ts';
import { type Check, guard } from '../shared/domain-error.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import type { ActionEffect } from './action-card-definition.ts';
import type { ActionTarget, ChosenTarget } from './action-card-state.ts';
import { BOARD_EFFECTS } from './board-effects.ts';
import { COMBAT_EFFECTS } from './combat-effects.ts';
import { ECONOMY_EFFECTS } from './economy-effects.ts';
import type {
  CardEffectInput,
  EffectRule,
  EffectRules,
  CardSituation,
  TargetOptions,
} from './effect-rule.ts';

/** Registry aller Wirkungsarten (Open/Closed: neue Karten brauchen nur Daten). */
const EFFECTS: EffectRules = { ...ECONOMY_EFFECTS, ...BOARD_EFFECTS, ...COMBAT_EFFECTS };

// TypeScript kann die Art der Wirkung nicht mit der Regel korrelieren.
const ruleOf = (effect: ActionEffect) => EFFECTS[effect.kind] as EffectRule<ActionEffect>;

export const situation = (
  state: GameState,
  player: PlayerId,
  effect: ActionEffect,
  content: ContentPort,
): CardSituation => ({ state, player, effect, content });

export const targetOptions = (input: CardSituation): TargetOptions =>
  ruleOf(input.effect).targets(input);

/** Spielbar, wenn jede verlangte Zielart eine Auswahl hat und die Zusatzbedingung gilt. */
export function effectUsable(input: CardSituation): boolean {
  const options = targetOptions(input);
  const choosable = [options.planets?.options, options.systems, options.players].every(
    (list) => list === undefined || list.length > 0,
  );
  return choosable && (ruleOf(input.effect).usable?.(input) ?? true);
}

/** Planeten: mindestens einer, höchstens `max`, keiner doppelt, alle zugelassen. */
function planetsValid(options: TargetOptions['planets'], planets: readonly PlanetId[]): boolean {
  if (options === undefined) return true;
  const distinct = new Set(planets).size === planets.length;
  const allowed = planets.every((planet) => options.options.includes(planet));
  return planets.length > 0 && planets.length <= options.max && distinct && allowed;
}

const within = <T>(options: readonly T[] | undefined, value: T | undefined): boolean =>
  options === undefined || (value !== undefined && options.includes(value));

/** Die gewählten Ziele müssen aus den zugelassenen stammen. */
export function targetCheck(options: TargetOptions, target: ActionTarget): Check {
  const valid =
    planetsValid(options.planets, target.planets ?? []) &&
    within(options.systems, target.system) &&
    within(options.players, target.player) &&
    within(options.pool === undefined ? undefined : COMMAND_POOLS, target.pool);
  return guard(valid, 'actionCard.invalidTarget', 'Ungültiges Ziel');
}

/** Einheitliche Form der (geprüften) Ziele für die Abhandlung. */
export const chosen = (target: ActionTarget): ChosenTarget => ({
  planets: target.planets ?? [],
  systems: target.system === undefined ? [] : [target.system],
  players: target.player === undefined ? [] : [target.player],
  pool: target.pool ?? 'tactic',
});

export const resolveEffect = (input: CardEffectInput): readonly GameEvent[] =>
  ruleOf(input.effect).resolve(input);
