import type { MapPing } from '@stellar/application';
import { create } from 'zustand';

interface MapPingStore {
  readonly pings: readonly MapPing[];
}

const MAX_PINGS = 8;
const MAX_LIFETIME_MS = 4000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useMapPingStore = create<MapPingStore>()(() => ({ pings: [] }));

function removePing(id: string): void {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
  useMapPingStore.setState(({ pings }) => ({ pings: pings.filter((ping) => ping.id !== id) }));
}

export function clearMapPings(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  useMapPingStore.setState({ pings: [] });
}

/** Pro Sitz bleibt nur die letzte Zeigegeste; auch fehlerhafte Laufzeiten können keine Dauermarker erzeugen. */
export function receiveMapPing(ping: MapPing): void {
  for (const known of useMapPingStore.getState().pings)
    if (known.seat === ping.seat || known.id === ping.id) removePing(known.id);
  const pings = [...useMapPingStore.getState().pings, ping];
  while (pings.length > MAX_PINGS) {
    const first = pings.shift();
    if (first !== undefined) removePing(first.id);
  }
  useMapPingStore.setState({ pings });
  const lifetime = Number.isFinite(ping.lifetimeMs) ? ping.lifetimeMs : MAX_LIFETIME_MS;
  timers.set(
    ping.id,
    setTimeout(() => removePing(ping.id), Math.min(MAX_LIFETIME_MS, Math.max(0, lifetime))),
  );
}
