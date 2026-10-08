import { Users } from 'lucide-react';
import type { LobbyView, SeatTicket } from '@stellar/application';
import type { ReactElement } from 'react';
import type { MessageKey } from '../../i18n.ts';
import { useOnlineStore } from '../../online/online-store.ts';
import { useT } from '../../use-translation.ts';
import { OnlineError } from './OnlineError.tsx';

type LobbySeatView = LobbyView['seats'][number];

function seatState(seat: LobbySeatView): MessageKey {
  if (seat.kind === 'open') return 'seatOpen';
  if (seat.kind === 'bot') return 'botBadge';
  return seat.connected ? 'connected' : 'offline';
}

function SeatRow(props: { readonly seat: LobbySeatView; readonly mine: boolean }): ReactElement {
  const t = useT();
  const { seat, mine } = props;
  return (
    <li className={`lobby-seat ${seat.kind}`} data-testid={`lobby-seat-${String(seat.seat)}`}>
      <span className="seat-number">{seat.seat + 1}</span>
      <span className="seat-name">{seat.name ?? '—'}</span>
      {seat.seat === 0 && <span className="badge">{t('seatHost')}</span>}
      {mine && <span className="badge">{t('seatYou')}</span>}
      <span className={`seat-state ${seatState(seat)}`}>{t(seatState(seat))}</span>
    </li>
  );
}

function HostControls({ ticket }: { readonly ticket: SeatTicket }): ReactElement {
  const t = useT();
  const start = useOnlineStore((state) => state.start);
  if (ticket.seat !== 0) return <p className="hint">{t('waitingForHost')}</p>;
  return (
    <button type="button" className="primary" onClick={() => void start()}>
      {t('startOnline')}
    </button>
  );
}

/** Wartesaal: Code zum Weitersagen, Plätze mit Verbindungsstatus, Start für den Gastgeber. */
export function LobbyPanel(): ReactElement | null {
  const t = useT();
  const { ticket, lobby, leave } = useOnlineStore();
  if (ticket === null) return null;
  return (
    <section className="online-panel lobby-panel glass" aria-label={t('lobby')}>
      <h2 className="setup-title">
        <Users size={16} aria-hidden="true" /> {t('lobby')}
      </h2>
      <p className="lobby-code" data-testid="lobby-code">
        {ticket.code}
      </p>
      <p className="hint">{t('lobbyShare')}</p>
      <ol className="lobby-seats">
        {lobby?.seats.map((seat) => (
          <SeatRow key={seat.seat} seat={seat} mine={seat.seat === ticket.seat} />
        ))}
      </ol>
      <HostControls ticket={ticket} />
      <button type="button" onClick={leave}>
        {t('leaveOnline')}
      </button>
      <OnlineError />
    </section>
  );
}
