import { X } from 'lucide-react';
import { type ReactElement, useEffect } from 'react';
import { useSimulatorStore } from '../../simulator/simulator-store.ts';
import { useT } from '../../use-translation.ts';
import { IconButton } from '../ui/IconButton.tsx';
import { BattleScreen } from './BattleScreen.tsx';
import { FactionPicker } from './FactionPicker.tsx';
import { FleetBuilder } from './FleetBuilder.tsx';

const STAGES = { faction: FactionPicker, fleet: FleetBuilder, battle: BattleScreen } as const;

/** Escape verlässt den Simulator, solange er offen ist. */
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

/** Der Kampfsimulator als eigener Vollbildmodus über der Karte. */
export function SimulatorScreen(): ReactElement | null {
  const t = useT();
  const { stage, close } = useSimulatorStore();
  useEscape(stage !== 'closed', close);
  if (stage === 'closed') return null;
  const Stage = STAGES[stage];
  return (
    <section
      className={`simulator stage-${stage}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('simulator')}
    >
      <div className="simulator-close">
        <IconButton icon={X} label={t('leaveSimulator')} onClick={close} side="bottom" />
      </div>
      <Stage />
    </section>
  );
}
