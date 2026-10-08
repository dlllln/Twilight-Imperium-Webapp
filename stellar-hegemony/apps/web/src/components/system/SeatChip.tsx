import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { seatColor } from '../../seat-colors.ts';
import { useT } from '../../use-translation.ts';

/** Name des Spielers auf einem Platz (1-basiert), vor der Partie nur „Platz n“. */
export function useSeatName(): (seat: number) => string {
  const t = useT();
  const players = useGameStore((state) => state.game?.players);
  return (seat) =>
    players?.find((player) => player.seat + 1 === seat)?.name ?? `${t('seat')} ${String(seat)}`;
}

export function SeatChip({ seat }: { readonly seat: number }): ReactElement {
  const name = useSeatName();
  return (
    <span className="seat-chip">
      <span className="swatch" style={{ background: seatColor(seat) }} />
      {name(seat)}
    </span>
  );
}
