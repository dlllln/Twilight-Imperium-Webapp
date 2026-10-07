import {
  bombardablePlanets,
  bombardingShips,
  type ContentPort,
  type GameState,
  isCenterSystem,
  landingForces,
  type PlanetId,
  type PlayerId,
  type SystemId,
  type Unit,
} from '@stellar/domain';

/** Spieler und System der laufenden Taktikaktion. */
export interface ActiveTactical {
  readonly player: PlayerId;
  readonly system: SystemId;
}

export function activeTactical(game: GameState): ActiveTactical | null {
  const turn = game.actionPhase;
  const system = turn?.tactical?.system;
  if (turn?.active == null || system === undefined) return null;
  return { player: turn.active, system };
}

export interface BombardChoices {
  readonly ships: readonly Unit[];
  readonly planets: readonly PlanetId[];
}

/** Schiffe mit Bombardement und erlaubte Ziele im aktivierten System (Abfragen der Domain). */
export function bombardChoices(game: GameState, content: ContentPort): BombardChoices {
  const active = activeTactical(game);
  if (active === null) return { ships: [], planets: [] };
  const { player, system } = active;
  return {
    ships: bombardingShips(game, system, player, content.units),
    planets: bombardablePlanets(game, system, player, content.units),
  };
}

export interface LandingChoices {
  readonly forces: readonly Unit[];
  readonly planets: readonly PlanetId[];
  /** Thronwelt: Landung kostet Einfluss, solange ihr Marker liegt. */
  readonly centerCost: number | null;
}

export function landingChoices(game: GameState, content: ContentPort): LandingChoices {
  const active = activeTactical(game);
  if (active === null) return { forces: [], planets: [], centerCost: null };
  const { player, system } = active;
  const center = isCenterSystem(content.tiles, system) && !game.centerTokenRemoved;
  return {
    forces: landingForces(game, system, player, content.units),
    planets: game.systems[system]?.planetIds ?? [],
    centerCost: center ? game.config.rules.centerTokenInfluenceCost : null,
  };
}
