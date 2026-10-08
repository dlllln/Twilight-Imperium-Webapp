import { Check } from 'lucide-react';
import { type ReactElement, useEffect } from 'react';
import { takenSeats } from '../../setup/faction-draft.ts';
import { useDraftStore } from '../../setup/draft-store.ts';
import { useT } from '../../use-translation.ts';
import { FactionChooser } from './FactionChooser.tsx';

/** Escape geht einen Schritt zurück, wie der Zurück-Knopf. */
function useEscape(open: boolean, back: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, back]);
}

/** Vor der Partie: jeder Mensch am Bildschirm wählt seine Fraktion, dann beginnt das Spiel. */
export function FactionDraft(): ReactElement | null {
  const t = useT();
  const { open, picks, preview, show, choose, back } = useDraftStore();
  useEscape(open, back);
  if (!open) return null;
  const seat = picks.length + 1;
  return (
    <section
      className="simulator stage-faction faction-draft"
      role="dialog"
      aria-modal="true"
      aria-label={t('chooseFaction')}
    >
      <FactionChooser
        title={t('conquest')}
        kicker={`P${String(seat)} ${t('seatChooses')}`}
        selected={preview}
        taken={takenSeats(picks)}
        chooseIcon={Check}
        onPreview={show}
        onChoose={choose}
        onBack={back}
      />
    </section>
  );
}
