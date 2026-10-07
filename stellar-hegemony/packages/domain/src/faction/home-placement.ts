import type { DecisionContext } from '../eventsourcing/command.ts';
import type { PlacedSystem } from '../galaxy/galaxy-events.ts';
import type { SystemTile } from '../galaxy/system-tile.ts';
import type { GameState } from '../game/game-state.ts';
import type { Hex } from '../hex/hex-coordinate.ts';
import type { PlayerState } from '../player/player-state.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import { UnitNumbering } from '../unit/unit-numbering.ts';
import { combine, err, ok, type Result } from '../shared/result.ts';
import type { FactionDefinition } from './faction-definition.ts';
import type { HomeSystemPlaced } from './home-events.ts';

function placedTile(tile: SystemTile, position: Hex): PlacedSystem {
  return {
    id: tile.id,
    position,
    planetIds: tile.planets.map((planet) => planet.id),
    wormholes: tile.wormholes,
    ...(tile.anomaly === undefined ? {} : { anomaly: tile.anomaly }),
  };
}

function placement(
  player: PlayerState,
  faction: FactionDefinition,
  position: Hex,
  numbering: UnitNumbering,
): HomeSystemPlaced {
  const { homeSystem, startingForces } = faction;
  const spaceUnits = numbering.create(player.id, startingForces.space);
  const planets = startingForces.planets.map((forces) => ({
    planet: forces.planet,
    units: numbering.create(player.id, forces.units),
  }));
  const system = placedTile(homeSystem, position);
  return { type: 'HomeSystemPlaced', player: player.id, system, spaceUnits, planets };
}

function factionOf(
  player: PlayerState,
  context: DecisionContext,
): Result<FactionDefinition, DomainError> {
  const faction = context.content.factions.find((candidate) => candidate.id === player.faction);
  return faction === undefined
    ? err(domainError('setup.unknownFaction', 'Unbekannte Fraktion', { faction: player.faction }))
    : ok(faction);
}

/** Jeder Spieler erhält sein Heimatsystem auf dem Heimat-Platz seines Sitzes. */
export function homeSystemEvents(
  state: GameState,
  context: DecisionContext,
): Result<readonly HomeSystemPlaced[], DomainError> {
  const factions = combine(state.players.map((player) => factionOf(player, context)));
  if (!factions.ok) return factions;
  const numbering = new UnitNumbering(state.nextUnitNumber);
  const events = state.players.flatMap((player, seat) => {
    const faction = factions.value[seat];
    const position = state.homeSlots[seat];
    return faction === undefined || position === undefined
      ? []
      : [placement(player, faction, position, numbering)];
  });
  return events.length === state.players.length
    ? ok(events)
    : err(domainError('setup.homeSlots', 'Nicht genug Heimat-Plätze'));
}
