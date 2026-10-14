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

/** Feste Farbreihenfolge der Plätze, passend zu den Heimat-Markierungen der Karte (bis 8 Plätze). */
export const SEAT_COLORS: readonly PlayerColor[] = [
  'orange',
  'blue',
  'green',
  'yellow',
  'purple',
  'red',
  'pink',
  'black',
];

export const seatPlayerId = (seat: number): PlayerId => playerId(`p${String(seat + 1)}`);

/** Eine Partie vor dem Start: Galaxie, Regeln und die Namen auf den Plätzen. */
export interface TableSpec {
  readonly gameId: GameId;
  readonly config: GameConfig;
  readonly mapString: string;
  readonly names: readonly string[];
  /** Gewählte Fraktion je Platz; ohne Wahl bekommt der Platz die nächste freie. */
  readonly picks: readonly (string | null)[];
}

export const createGameCommand = (table: TableSpec): CreateGame => ({
  type: 'CreateGame',
  issuedBy: seatPlayerId(0),
  gameId: table.gameId,
  config: table.config,
});

/**
 * Fraktionen in Sitzreihenfolge: gewählte bleiben, wer nicht gewählt hat (auch die KI),
 * bekommt der Reihe nach die übrigen Fraktionen in der Reihenfolge des Inhalts.
 */
export function seatFactions(
  all: readonly FactionDefinition[],
  picks: readonly (string | null)[],
  seats: number,
): readonly (FactionDefinition | undefined)[] {
  // Doppelt gewählt zählt nur beim ersten Platz.
  const chosen = Array.from({ length: seats }, (_, seat) =>
    picks.indexOf(picks[seat] ?? null) === seat
      ? all.find((faction) => faction.id === picks[seat])
      : undefined,
  );
  const free = all.filter((faction) => !chosen.includes(faction));
  const before = (seat: number) =>
    chosen.slice(0, seat).filter((pick) => pick === undefined).length;
  return chosen.map((pick, seat) => pick ?? free[before(seat)]);
}

function seatCommand(name: string, seat: number, faction: FactionDefinition | undefined) {
  return {
    type: 'SeatPlayer',
    issuedBy: seatPlayerId(seat),
    name,
    color: SEAT_COLORS[seat] ?? 'black',
    faction: faction?.id ?? factionId('unbekannt'),
    commodityLimit: faction?.commodityLimit ?? 0,
  } as const;
}

/**
 * Aufbau nach `CreateGame` (Pure Fabrication): Plätze mit ihren Fraktionen besetzen,
 * Galaxie übernehmen, starten.
 */
export function setupCommands(
  table: TableSpec,
  factions: readonly FactionDefinition[],
): readonly GameCommand[] {
  const host = seatPlayerId(0);
  const seated = seatFactions(factions, table.picks, table.names.length);
  return [
    ...table.names.map((name, seat) => seatCommand(name, seat, seated[seat])),
    { type: 'ImportMap', issuedBy: host, mapString: table.mapString },
    { type: 'StartGame', issuedBy: host },
  ];
}
