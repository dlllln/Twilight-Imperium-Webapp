import { AnimatePresence, motion } from 'motion/react';
import { lazy, type ReactElement, Suspense, useEffect, useMemo, useRef } from 'react';
import type { SceneHex } from '../../render/scene-model.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { systemLayout } from '../../system/system-layout.ts';
import { useSystemViewStore } from '../../system/system-view-store.ts';
import { useElementSize } from '../../system/use-element-size.ts';
import { useT } from '../../use-translation.ts';
import { SystemContents } from './SystemContents.tsx';
import { SystemHeader } from './SystemHeader.tsx';
import { SystemLabels } from './SystemLabels.tsx';

/** Pixi wird wie bei der Karte nachgeladen. */
const SystemCanvas = lazy(() =>
  import('./SystemCanvas.tsx').then((module) => ({ default: module.SystemCanvas })),
);

/**
 * Kein Fenster: Die Ansicht blendet sich gegen Ende der Kamerafahrt aus der Unschärfe ein,
 * als zoome die Karte einfach weiter in das System hinein.
 */
const OPEN = { delay: 0.35, duration: 0.6, ease: [0.22, 1, 0.36, 1] } as const;
const CLOSE = { duration: 0.35, ease: [0.4, 0, 1, 1] } as const;
const FAR = { opacity: 0, scale: 0.72, filter: 'blur(10px)' } as const;
const NEAR = { opacity: 1, scale: 1, filter: 'blur(0px)' } as const;

function useEscapeToClose(): void {
  const close = useSystemViewStore((state) => state.close);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
}

function SystemStage({ hex }: { readonly hex: SceneHex }): ReactElement {
  const t = useT();
  const motionOn = useSettingsStore((state) => state.animations);
  const stage = useRef<HTMLDivElement>(null);
  const size = useElementSize(stage);
  const layout = useMemo(() => systemLayout(hex), [hex]);
  useEscapeToClose();
  return (
    <section className="system-view" aria-label={t('systemView')} data-system-view={hex.key}>
      <div ref={stage} className="system-stage">
        <Suspense fallback={null}>
          <SystemCanvas layout={layout} systemKey={hex.key} motion={motionOn} />
        </Suspense>
        <SystemLabels layout={layout} size={size} />
      </div>
      <SystemHeader hex={hex} />
      <div className="sr-only">
        <SystemContents layout={layout} />
      </div>
    </section>
  );
}

/** Ebene über der Karte; Herauszoomen mit dem Mausrad kehrt zur Sternenkarte zurück. */
export function SystemView({ hexes }: { readonly hexes: readonly SceneHex[] }): ReactElement {
  const key = useSystemViewStore((state) => state.key);
  const close = useSystemViewStore((state) => state.close);
  const animations = useSettingsStore((state) => state.animations);
  const hex = hexes.find((candidate) => candidate.key === key && candidate.kind === 'system');
  const instant = { duration: 0 };
  return (
    <AnimatePresence>
      {hex !== undefined && (
        <motion.div
          key={hex.key}
          className="system-layer"
          initial={FAR}
          animate={{ ...NEAR, transition: animations ? OPEN : instant }}
          exit={{ ...FAR, transition: animations ? CLOSE : instant }}
          onWheel={(event) => {
            if (event.deltaY > 0) close();
          }}
        >
          <SystemStage hex={hex} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
