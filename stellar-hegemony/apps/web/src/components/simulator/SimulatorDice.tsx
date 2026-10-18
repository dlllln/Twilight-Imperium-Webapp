import type { SimRoundReport, Volley } from '@stellar/domain';
import { type ReactElement, type ReactNode, useEffect, useRef } from 'react';
import { YOU } from '../../simulator/simulator-rules.ts';
import { useSimulatorStore } from '../../simulator/simulator-store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { DiceTray } from '../combat/DiceTray.tsx';

function useReportBox(settled: boolean) {
  const box = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (settled && box.current !== null) box.current.scrollTop = 0;
  }, [settled]);
  return box;
}

function SideVolley({
  volley,
  barrage = false,
}: {
  readonly volley: Volley;
  readonly barrage?: boolean;
}) {
  const t = useT();
  return (
    <section className="sim-dice-side">
      <h4>
        {t(volley.player === YOU ? 'yourVolley' : 'rivalVolley')}
        {barrage && ` · ${t('barrageVolley')}`}
      </h4>
      <DiceTray volley={volley} />
    </section>
  );
}

function FinishAnimation(): ReactElement | null {
  const language = useLanguage();
  const { battle, shown, settle } = useSimulatorStore();
  if (shown === battle) return null;
  return (
    <button type="button" className="dice-reveal" onClick={settle}>
      {language === 'de' ? 'Kampfanimation beenden' : 'Finish battle animation'}
    </button>
  );
}

/** Auch der Simulator zeigt die unveränderten Einzelwürfe seines Rundenberichts. */
export function SimulatorDice({
  report,
  children,
  collapsed,
}: {
  readonly report: SimRoundReport;
  readonly children: ReactNode;
  readonly collapsed: boolean;
}): ReactElement {
  const settled = useSimulatorStore((state) => state.shown === state.battle);
  const box = useReportBox(settled);
  return (
    <details ref={box} className="round-log sim-dice-report" open={!collapsed}>
      <summary>{children}</summary>
      <div className="sim-dice-trays">
        {report.barrage.map(({ volley }) => (
          <SideVolley key={`barrage-${volley.player}`} volley={volley} barrage />
        ))}
        {report.volleys.map((volley) => (
          <SideVolley key={volley.player} volley={volley} />
        ))}
      </div>
      <FinishAnimation />
    </details>
  );
}
