import { findPlayer, type GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlayerId, RelicId } from '../shared/ids.ts';
import type { RelicDefinition, RelicEffect } from './exploration-definition.ts';

type Relics = Pick<ContentPort, 'relics'>;

export type PassiveRelic = Extract<RelicEffect, { readonly kind: 'passive' }>;

export const findRelic = (content: Relics, id: RelicId): RelicDefinition | undefined =>
  content.relics.find((relic) => relic.id === id);

/** Stammdaten der Relikte, die ein Spieler hält. */
export function heldRelics(
  state: GameState,
  player: PlayerId,
  content: Relics,
): readonly RelicDefinition[] {
  const owned = findPlayer(state, player)?.relics ?? [];
  return owned.flatMap((relic) => findRelic(content, relic.id) ?? []);
}

/** PoK Relikt: dauerhafte Wirkungen der gehaltenen Relikte (Einheitenwerte, Flottenlimit). */
export const passiveRelics = (
  state: GameState,
  player: PlayerId,
  content: Relics,
): readonly PassiveRelic[] =>
  heldRelics(state, player, content).flatMap(({ effect }) =>
    effect.kind === 'passive' ? [effect] : [],
  );
