import type { DecisionContext } from '../eventsourcing/command.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import type { PlanetId, PlayerId, SystemId } from '../shared/ids.ts';
import type { ActionEffect, EffectKind } from './action-card-definition.ts';
import type { ChosenTarget } from './action-card-state.ts';

/** Lage, in der eine Karte geprüft oder abgehandelt wird. */
export interface CardSituation<E extends ActionEffect = ActionEffect> {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly effect: E;
  readonly content: ContentPort;
}

export interface CardEffectInput<E extends ActionEffect = ActionEffect> extends CardSituation<E> {
  readonly target: ChosenTarget;
  readonly random: DecisionContext['random'];
}

/** Welche Ziele eine Karte gerade zulässt; leere Listen machen sie unspielbar (RR 51.3). */
export interface TargetOptions {
  readonly planets?: { readonly options: readonly PlanetId[]; readonly max: number };
  readonly systems?: readonly SystemId[];
  readonly players?: readonly PlayerId[];
  readonly pool?: true;
}

/**
 * Strategy je Wirkungsart: mögliche Ziele, Zusatzbedingung und Abhandlung.
 * Die Abhandlung bekommt nur Ziele, die `targets` vorher zugelassen hat.
 */
export interface EffectRule<E extends ActionEffect> {
  targets(situation: CardSituation<E>): TargetOptions;
  usable?(situation: CardSituation<E>): boolean;
  resolve(input: CardEffectInput<E>): readonly GameEvent[];
}

export type EffectRules = {
  readonly [K in EffectKind]: EffectRule<Extract<ActionEffect, { kind: K }>>;
};

export const NO_OPTIONS: TargetOptions = {};
