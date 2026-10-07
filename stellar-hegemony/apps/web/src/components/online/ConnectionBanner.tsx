import type { ReactElement } from 'react';
import { useOnlineStore } from '../../online/online-store.ts';
import { useT } from '../../use-translation.ts';

/** Bricht die Verbindung ab, verbindet Socket.IO selbst neu; bis dahin ein Hinweis. */
export function ConnectionBanner(): ReactElement | null {
  const t = useT();
  const reconnecting = useOnlineStore((state) => state.status === 'reconnecting');
  if (!reconnecting) return null;
  return (
    <p className="connection-banner" role="status">
      {t('reconnecting')}
    </p>
  );
}
