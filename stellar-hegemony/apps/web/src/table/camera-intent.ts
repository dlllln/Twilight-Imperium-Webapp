import { type GameState, type SystemId, systemOfPlanet } from '@stellar/domain';
import { content } from '../store.ts';
import { movementChoices } from '../tactical-view.ts';
import type { DecisionRoute } from './decision-route.ts';
import { parseTargetKey, type TargetRef, type TargetState } from './target-ref.ts';

/*
 * Was die Kamera für die laufende Entscheidung ins Bild nehmen soll (reine Funktion): das
 * aktivierte System der taktischen Aktion, die Herkunft beweglicher Schiffe und die Systeme der
 * Ziele auf der Karte (Systeme und Planeten als Bau- oder Landeplatz). Sonst nichts.
 */

/** Das System eines Ziels auf der Karte; andere Ziele liegen am Pult. */
function systemOfTarget(game: GameState, ref: TargetRef | null): SystemId | null {
  if (ref?.kind === 'system') return ref.id;
  if (ref?.kind !== 'site') return null;
  return systemOfPlanet(game, ref.id)?.id ?? null;
}

/** Aktiviertes System und Herkunft der Schiffe, solange die eigene taktische Aktion läuft. */
function tacticalSystems(game: GameState, route: DecisionRoute): readonly SystemId[] {
  const active = game.actionPhase?.tactical?.system;
  if (route.kind !== 'tactical' || active === undefined) return [];
  return [active, ...movementChoices(game, content).map((option) => option.from)];
}

export function framingOf(
  game: GameState,
  route: DecisionRoute | null,
  targets: ReadonlyMap<string, TargetState>,
): readonly SystemId[] {
  if (route === null) return [];
  const fromTargets = [...targets.keys()].flatMap((key) => {
    const system = systemOfTarget(game, parseTargetKey(key));
    return system === null ? [] : [system];
  });
  return [...new Set([...tacticalSystems(game, route), ...fromTargets])];
}
