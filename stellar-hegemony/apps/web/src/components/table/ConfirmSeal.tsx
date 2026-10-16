import type { ReactElement } from 'react';
import type { MessageKey } from '../../i18n.ts';
import { useT } from '../../use-translation.ts';

interface SealProps {
  /** Die bekannte Beschriftung (z. B. „Ausführen“); sie ist zugleich der Name des Knopfs. */
  readonly label: MessageKey;
  readonly ready: boolean;
  readonly onConfirm: () => void;
}

/**
 * Das Siegel der Ansage: ein achteckiger Messingstein, der die Entscheidung als genau einen
 * Befehl abschickt. Solange der Entwurf nicht fertig ist, bleibt er matt und gesperrt.
 */
export function ConfirmSeal({ label, ready, onConfirm }: SealProps): ReactElement {
  const t = useT();
  return (
    <button
      type="button"
      className="confirm-seal"
      data-testid="confirm"
      disabled={!ready}
      onClick={onConfirm}
    >
      {t(label)}
    </button>
  );
}
