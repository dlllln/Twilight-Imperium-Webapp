import {
  type CreateGame,
  type FactionDefinition,
  factionId,
  type GameCommand,
  type GameConfig,
  type GameId,
  type PlayerColor,
  playerId,
  type PlayerId,
} from '@stellar/domain';

/** Feste Farbreihenfolge der Plätze, passend zu den Heimat-Markierungen der Karte. */
const COLORS: readonly PlayerColor[] = ['orange', 'blue', 'green', 'yellow', 'purple', 'red'];

export const seatPlayerId = (seat: number): PlayerId => playerId(`p${String(seat + 1)}`);

/** Eine Partie vor dem Start: Galaxie, Regeln und die Namen auf den Plätzen. */
export interface TableSpec {
  readonly gameId: GameId;
  readonly config: GameConfig;
  readonly mapString: string;
  readonly names: readonly string[];
}

export const createGameCommand = (table: TableSpec): CreateGame => ({
  type: 'CreateGame',
  issuedBy: seatPlayerId(0),
  gameId: table.gameId,
  config: table.config,
});

function seatCommand(name: string, seat: number, factions: readonly FactionDefinition[]) {
  const faction = factions[seat];
  return {
    type: 'SeatPlayer',
    issuedBy: seatPlayerId(seat),
    name,
    color: COLORS[seat] ?? 'black',
    faction: faction?.id ?? factionId('unbekannt'),
    commodityLimit: faction?.commodityLimit ?? 0,
  } as const;
}

/**
 * Aufbau nach `CreateGame` (Pure Fabrication): Plätze besetzen, Galaxie übernehmen, starten.
 * Hot-Seat und Online-Server bauen eine Partie mit genau denselben Commands auf.
 */
export function setupCommands(
  table: TableSpec,
  factions: readonly FactionDefinition[],
): readonly GameCommand[] {
  const host = seatPlayerId(0);
  return [
    ...table.names.map((name, seat) => seatCommand(name, seat, factions)),
    { type: 'ImportMap', issuedBy: host, mapString: table.mapString },
    { type: 'StartGame', issuedBy: host },
  ];
}
