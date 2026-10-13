import { Check } from 'lucide-react';
import { type ReactElement, useEffect } from 'react';
import { useOnlineStore } from '../../online/online-store.ts';
import { takenSeats, useFactionPick } from '../../setup/faction-draft.ts';
import { useT } from '../../use-translation.ts';
import { FactionChooser } from './FactionChooser.tsx';

/** Escape schließt die Auswahl, wie der Zurück-Knopf. */
function useEscape(open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);
}

/** Wählen schickt die Wahl an den Server; erst wenn er sie annimmt, schließt die Auswahl. */
function useChoice(seat: number) {
  const { preview, show, close } = useFactionPick();
  const { lobby, chooseFaction } = useOnlineStore();
  const taken = takenSeats(lobby?.seats ?? [], seat);
  const choose = () => {
    void chooseFaction(preview).then((done) => {
      if (done) close();
    });
  };
  const look = (id: string) => {
    if (taken[id] === undefined) show(id);
  };
  return { taken, choose, look };
}

/** In der Lobby: die eigene Fraktion wählen; was andere gewählt haben, ist gesperrt. */
export function FactionDraft(): ReactElement | null {
  const t = useT();
  const { open, preview, close } = useFactionPick();
  const ticket = useOnlineStore((state) => state.ticket);
  const { taken, choose, look } = useChoice(ticket?.seat ?? -1);
  useEscape(open, close);
  if (!open || ticket === null) return null;
  return (
    <section
      className="simulator stage-faction faction-draft"
      role="dialog"
      aria-modal="true"
      aria-label={t('chooseFaction')}
    >
      <FactionChooser
        title={t('conquest')}
        kicker={`P${String(ticket.seat + 1)} ${t('seatChooses')}`}
        selected={preview}
        taken={taken}
        chooseIcon={Check}
        onPreview={look}
        onChoose={choose}
        onBack={close}
      />
    </section>
  );
}
