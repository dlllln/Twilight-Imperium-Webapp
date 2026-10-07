import {
  type ContentPort,
  type GameState,
  isGroundForce,
  type MoveContext,
  type MovementOption,
  movementOptions,
  type PlayerId,
  technologyCatalog,
  type Unit,
} from '@stellar/domain';
import type { Highlight } from './render/scene-model.ts';

/** Bewegungskontext, solange der aktive Spieler in seiner Taktikaktion noch ziehen darf. */
export function moveContextOf(game: GameState, content: ContentPort): MoveContext | null {
  const turn = game.actionPhase;
  const tactical = turn?.tactical;
  if (turn?.active == null || tactical == null || tactical.step !== 'movement') return null;
  return {
    state: game,
    player: turn.active,
    active: tactical.system,
    catalog: technologyCatalog(game, content),
    rules: game.config.rules,
  };
}

export const movementChoices = (
  game: GameState,
  content: ContentPort,
): readonly MovementOption[] => {
  const context = moveContextOf(game, content);
  return context === null ? [] : movementOptions(context);
};

/** Aktiviertes System, eigene Auswahl und Herkunftssysteme beweglicher Schiffe. */
export function highlightsOf(
  game: GameState,
  options: readonly MovementOption[],
  selected: string | null,
): ReadonlyMap<string, Highlight> {
  const highlights = new Map<string, Highlight>(options.map((option) => [option.from, 'origin']));
  if (selected !== null) highlights.set(selected, 'selected');
  const active = game.actionPhase?.tactical?.system;
  if (active !== undefined) highlights.set(active, 'active');
  return highlights;
}

/**
 * Fracht, die ein Schiff im Herkunftssystem aufnehmen kann: eigene Jäger und
 * Bodentruppen im Raum sowie eigene Bodentruppen auf eigenen Planeten.
 */
export function cargoAtOrigin(
  game: GameState,
  content: ContentPort,
  option: MovementOption,
  player: PlayerId,
): readonly Unit[] {
  const system = game.systems[option.from];
  if (system === undefined) return [];
  const transportable = (unit: Unit) => {
    const definition = technologyCatalog(game, content).find(unit.type, unit.owner);
    return (
      unit.owner === player &&
      definition !== undefined &&
      (definition.isFighter || isGroundForce(definition))
    );
  };
  const onPlanets = system.planetIds.flatMap((id) => game.planets[id]?.units ?? []);
  return [...system.spaceUnits, ...onPlanets].filter(transportable);
}
