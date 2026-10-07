import { landingForces, groundForcesOn } from '../invasion/invasion-queries.ts';
import type { GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { InvasionRole } from './action-card-definition.ts';
import { type EffectRules, NO_OPTIONS } from './effect-rule.ts';

const pendingHitsOf = (state: GameState, player: PlayerId): number =>
  state.actionPhase?.tactical?.pendingHits.find((entry) => entry.player === player)?.hits ?? 0;

const attacking = (state: GameState, player: PlayerId, content: ContentPort): boolean => {
  const system = state.actionPhase?.tactical?.system;
  return (
    system !== undefined &&
    state.actionPhase?.active === player &&
    landingForces(state, system, player, content.units).length > 0
  );
};

const defending = (state: GameState, player: PlayerId, content: ContentPort): boolean => {
  const system = state.actionPhase?.tactical?.system;
  const planets = system === undefined ? [] : (state.systems[system]?.planetIds ?? []);
  return (
    state.actionPhase?.active !== player &&
    planets.some(
      (planet) => groundForcesOn(state, planet, content.units, (o) => o === player).length > 0,
    )
  );
};

/** Angreifer: eigene Bodentruppen bereit zur Landung; Verteidiger: Bodentruppen auf einem Planeten. */
const INVASION_ROLES: Readonly<
  Record<InvasionRole, (state: GameState, player: PlayerId, content: ContentPort) => boolean>
> = { attacker: attacking, defender: defending };

/** Wirkungen in Kampf, Einmarsch und Strategieaktionen sowie das Verhindern. */
export const COMBAT_EFFECTS = {
  combatBonus: {
    targets: () => NO_OPTIONS,
    usable: ({ state, player }) => {
      const combat = state.actionPhase?.tactical?.combat;
      return combat != null && (combat.attacker === player || combat.defender === player);
    },
    resolve: ({ state, player, effect }) => [
      {
        type: 'CombatBonusGranted',
        bonus: {
          player,
          kind: 'space',
          amount: effect.amount,
          round: state.actionPhase?.tactical?.combat?.round ?? null,
        },
      },
    ],
  },
  cancelHits: {
    targets: () => NO_OPTIONS,
    usable: ({ state, player }) => pendingHitsOf(state, player) > 0,
    resolve: ({ state, player, effect }) => [
      {
        type: 'HitsCancelled',
        player,
        amount: Math.min(effect.amount, pendingHitsOf(state, player)),
      },
    ],
  },
  groundBonus: {
    targets: () => NO_OPTIONS,
    usable: ({ state, player, effect, content }) =>
      INVASION_ROLES[effect.role](state, player, content),
    resolve: ({ player, effect }) => [
      {
        type: 'CombatBonusGranted',
        bonus: { player, kind: 'ground', amount: effect.amount, round: null },
      },
    ],
  },
  freeSecondary: {
    targets: () => NO_OPTIONS,
    resolve: ({ player }) => [{ type: 'SecondaryCostWaived', players: [player] }],
  },
  cancelCard: {
    targets: () => NO_OPTIONS,
    // Das Verhindern selbst handelt `playActionCard` ab; als Wirkung bleibt nichts zu tun.
    resolve: () => [],
  },
} as const satisfies Pick<
  EffectRules,
  'combatBonus' | 'cancelHits' | 'groundBonus' | 'freeSecondary' | 'cancelCard'
>;
