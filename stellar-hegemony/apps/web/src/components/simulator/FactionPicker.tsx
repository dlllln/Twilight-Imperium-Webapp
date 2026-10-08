import { Swords } from 'lucide-react';
import type { ReactElement } from 'react';
import { useSimulatorStore } from '../../simulator/simulator-store.ts';
import { useT } from '../../use-translation.ts';
import { FactionChooser } from '../faction/FactionChooser.tsx';

const NONE_TAKEN = {};

/** Erster Schritt des Simulators: Fraktion wählen, links die Liste, rechts die Einzelheiten. */
export function FactionPicker(): ReactElement {
  const t = useT();
  const { faction, preview, confirmFaction, close } = useSimulatorStore();
  return (
    <FactionChooser
      title={t('simulator')}
      kicker={t('chooseFaction')}
      selected={faction}
      taken={NONE_TAKEN}
      chooseIcon={Swords}
      onPreview={preview}
      onChoose={confirmFaction}
      onBack={close}
    />
  );
}
