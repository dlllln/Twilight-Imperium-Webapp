import { Box, LocateFixed, RotateCcw, RotateCw, Square, ZoomIn, ZoomOut } from 'lucide-react';
import type { ReactElement } from 'react';
import { isTopView, useOrbitStore } from '../system/orbit-store.ts';
import { useT } from '../use-translation.ts';
import { IconButton } from './ui/IconButton.tsx';

/** Drehen und zwischen Draufsicht und schräger Ansicht wechseln. */
function OrbitButtons(): ReactElement {
  const t = useT();
  const { rotateStep, toggleTop } = useOrbitStore.getState();
  const top = useOrbitStore(isTopView);
  return (
    <>
      <IconButton icon={RotateCcw} label={t('rotateLeft')} onClick={() => rotateStep(1)} />
      <IconButton icon={RotateCw} label={t('rotateRight')} onClick={() => rotateStep(-1)} />
      <IconButton
        icon={top ? Box : Square}
        label={t(top ? 'tiltedView' : 'topView')}
        onClick={toggleTop}
      />
    </>
  );
}

/** Schwebende Kartensteuerung: zoomen, drehen, neigen und zurücksetzen. */
export function MapControls({
  onZoom,
  onReset,
}: {
  readonly onZoom: (factor: number) => void;
  readonly onReset: () => void;
}): ReactElement {
  const t = useT();
  const reset = () => {
    onReset();
    useOrbitStore.getState().resetOrbit();
  };
  return (
    <div className="map-controls glass" role="toolbar" aria-label={t('systemHint')}>
      <IconButton icon={ZoomIn} label={t('zoomIn')} onClick={() => onZoom(ZOOM_STEP)} />
      <IconButton icon={ZoomOut} label={t('zoomOut')} onClick={() => onZoom(1 / ZOOM_STEP)} />
      <OrbitButtons />
      <IconButton icon={LocateFixed} label={t('resetView')} onClick={reset} />
    </div>
  );
}

export const ZOOM_STEP = 1.25;
