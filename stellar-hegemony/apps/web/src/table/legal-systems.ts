import { type GameState, type PlayerId, type SystemId, systemId } from '@stellar/domain';
import { freeTurn, interrupted } from '../hand/turn-guards.ts';
import { tryCommand } from '../rules-preview.ts';

/*
 * Welche Systeme sich jetzt aktivieren lassen. Entscheidet die Domain: `ActivateSystem` wird je
 * System an einer Kopie erprobt. Das Ergebnis hängt je Spielstand und Spieler im Speicher.
 */

const CACHE = new WeakMap<GameState, Map<PlayerId, readonly SystemId[]>>();

const turnOpen = (game: GameState, actor: PlayerId): boolean =>
  game.phase === 'action' && freeTurn(game) && !interrupted(game, actor);

function probe(game: GameState, actor: PlayerId): readonly SystemId[] {
  if (!turnOpen(game, actor)) return [];
  return Object.keys(game.systems)
    .map(systemId)
    .filter((system) => tryCommand(game, { type: 'ActivateSystem', issuedBy: actor, system }).ok);
}

/** Systeme, die `actor` jetzt mit einem Taktikmarker aktivieren darf. */
export function activatableSystems(game: GameState, actor: PlayerId): readonly SystemId[] {
  const byActor = CACHE.get(game) ?? new Map<PlayerId, readonly SystemId[]>();
  CACHE.set(game, byActor);
  const known = byActor.get(actor);
  if (known !== undefined) return known;
  const systems = probe(game, actor);
  byActor.set(actor, systems);
  return systems;
}

/** Aktivieren geht nur ohne offene strategische Aktion und nur in erlaubte Systeme. */
export const canActivateNow = (
  game: GameState,
  actor: PlayerId,
  system: string,
  choosing: boolean,
): boolean => !choosing && activatableSystems(game, actor).includes(systemId(system));
