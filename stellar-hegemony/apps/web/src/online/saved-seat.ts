import type { SeatTicket } from '@stellar/application';

const TICKET_KEY = 'stellar.online.ticket';
const NAME_KEY = 'stellar.online.name';

/** Speicher kann fehlen (privates Fenster); dann gibt es eben kein Wiederverbinden nach Reload. */
function attempt<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    return fallback;
  }
}

const isTicket = (value: unknown): value is SeatTicket =>
  typeof value === 'object' &&
  value !== null &&
  'code' in value &&
  'token' in value &&
  typeof value.code === 'string' &&
  typeof value.token === 'string';

export const loadTicket = (): SeatTicket | null =>
  attempt(() => {
    const parsed: unknown = JSON.parse(localStorage.getItem(TICKET_KEY) ?? 'null');
    return isTicket(parsed) ? parsed : null;
  }, null);

export const saveTicket = (ticket: SeatTicket | null): void =>
  attempt(() => {
    if (ticket === null) localStorage.removeItem(TICKET_KEY);
    else localStorage.setItem(TICKET_KEY, JSON.stringify(ticket));
  }, undefined);

export const loadName = (): string => attempt(() => localStorage.getItem(NAME_KEY) ?? '', '');

export const saveName = (name: string): void =>
  attempt(() => localStorage.setItem(NAME_KEY, name), undefined);
