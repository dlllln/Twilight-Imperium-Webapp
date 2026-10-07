import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { LawEffect } from './agenda-definition.ts';
import type { EnactedLaw } from './agenda-state.ts';

/** +1 beim Beschließen, −1 beim Aufheben: jede Gesetzeswirkung ist umkehrbar. */
type Direction = 1 | -1;

type LawApplier<E extends LawEffect> = (
  state: GameState,
  effect: E,
  owner: PlayerId | null,
  direction: Direction,
) => GameState;

type LawAppliers = {
  readonly [K in LawEffect['kind']]: LawApplier<Extract<LawEffect, { kind: K }>>;
};

const forOwner = (
  state: GameState,
  owner: PlayerId | null,
  update: Parameters<typeof updatePlayer>[2],
) => (owner === null ? state : updatePlayer(state, owner, update));

/** Strategy je Gesetzesart: wie es den Zustand verändert (OCP: neue Gesetze sind Daten). */
const APPLIERS: LawAppliers = {
  ruleChange: (state, effect, _owner, direction) => {
    const rules = state.config.rules;
    const value = rules[effect.rule] + direction * effect.delta;
    return { ...state, config: { ...state.config, rules: { ...rules, [effect.rule]: value } } };
  },
  commodityLimitAll: (state, effect, _owner, direction) => ({
    ...state,
    players: state.players.map((player) => ({
      ...player,
      commodityLimit: player.commodityLimit + direction * effect.delta,
    })),
  }),
  ownerVotes: (state) => state,
  ownerVictoryPoints: (state, effect, owner, direction) =>
    forOwner(state, owner, (player) => ({
      ...player,
      victoryPoints: Math.max(0, player.victoryPoints + direction * effect.amount),
    })),
  ownerCommodityLimit: (state, effect, owner, direction) =>
    forOwner(state, owner, (player) => ({
      ...player,
      commodityLimit: player.commodityLimit + direction * effect.amount,
    })),
};

// TypeScript kann die Art der Wirkung nicht mit dem Applier korrelieren.
const applierOf = (effect: LawEffect) => APPLIERS[effect.kind] as LawApplier<LawEffect>;

export const applyLaw = (state: GameState, law: EnactedLaw, direction: Direction): GameState =>
  applierOf(law.effect)(state, law.effect, law.owner, direction);

/** Zusätzliche Stimmen aus Gesetzen, die der Spieler besitzt. */
export const lawVotes = (state: GameState, player: PlayerId): number =>
  state.laws
    .filter((law) => law.owner === player)
    .reduce((sum, law) => sum + (law.effect.kind === 'ownerVotes' ? law.effect.amount : 0), 0);
