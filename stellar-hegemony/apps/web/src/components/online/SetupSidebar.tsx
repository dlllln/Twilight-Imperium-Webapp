import type { ReactElement } from 'react';
import { useOnlineStore } from '../../online/online-store.ts';
import { MapStringPanel } from '../MapStringPanel.tsx';
import { LobbyPanel } from './LobbyPanel.tsx';
import { OnlinePanel } from './OnlinePanel.tsx';

/** Vor der Partie: Online-Lobby oder Galaxie-Aufbau mit Map-String. */
export function SetupSidebar(): ReactElement {
  const seated = useOnlineStore((state) => state.ticket !== null);
  return (
    <div className="setup-sidebar">
      {seated ? <LobbyPanel /> : <OnlinePanel />}
      {!seated && <MapStringPanel />}
    </div>
  );
}
