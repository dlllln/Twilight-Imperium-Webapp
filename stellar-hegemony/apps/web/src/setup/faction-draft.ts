import type { LobbyView } from '@stellar/application';
import type { FactionDefinition } from '@stellar/domain';
import { create } from 'zustand';

/*
 * Fraktionswahl in der Lobby: Jeder wählt auf seinem eigenen Gerät. Was andere schon gewählt
 * haben, ist gesperrt; wer nichts wählt (auch die KI), bekommt beim Start eine freie Fraktion.
 */

type Seats = LobbyView['seats'];

/** Welcher Platz (1-basiert) eine Fraktion schon genommen hat; der eigene zählt nicht. */
export const takenSeats = (seats: Seats, mine: number): Readonly<Record<string, number>> =>
  Object.fromEntries(
    seats.flatMap((seat) =>
      seat.faction === null || seat.seat === mine ? [] : [[seat.faction, seat.seat + 1]],
    ),
  );

/** Vorschlag beim Öffnen: die eigene Wahl, sonst die erste freie Fraktion. */
export function suggestion(all: readonly FactionDefinition[], seats: Seats, mine: number): string {
  const own = seats.find((seat) => seat.seat === mine)?.faction;
  if (own !== null && own !== undefined) return own;
  const taken = takenSeats(seats, mine);
  return all.find((faction) => taken[faction.id] === undefined)?.id ?? '';
}

interface FactionPickStore {
  readonly open: boolean;
  readonly preview: string;
  readonly begin: (preview: string) => void;
  readonly show: (faction: string) => void;
  readonly close: () => void;
}

export const useFactionPick = create<FactionPickStore>((set) => ({
  open: false,
  preview: '',
  begin: (preview) => set({ open: true, preview }),
  show: (preview) => set({ preview }),
  close: () => set({ open: false }),
}));
