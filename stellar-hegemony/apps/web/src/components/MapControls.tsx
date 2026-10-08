import { LocateFixed, Telescope, ZoomIn, ZoomOut } from 'lucide-react';
import type { ReactElement } from 'react';
import { useGalaxyStore } from '../store.ts';
import { useT } from '../use-translation.ts';
import { IconButton } from './ui/IconButton.tsx';

const ZOOM_STEP = 1.25;

/** Schwebende Kartensteuerung: zoomen, zurücksetzen, ins gewählte System hineinzoomen. */
export function MapControls({ onOpen }: { readonly onOpen: (() => void) | null }): ReactElement {
  const t = useT();
  const { zoomBy, resetView } = useGalaxyStore();
  return (
    <div className="map-controls glass" role="toolbar" aria-label={t('systemHint')}>
      <IconButton icon={ZoomIn} label={t('zoomIn')} onClick={() => zoomBy(ZOOM_STEP)} />
      <IconButton icon={ZoomOut} label={t('zoomOut')} onClick={() => zoomBy(1 / ZOOM_STEP)} />
      <IconButton icon={LocateFixed} label={t('resetView')} onClick={resetView} />
      <IconButton
        icon={Telescope}
        label={onOpen === null ? t('pickSystemFirst') : t('openSystem')}
        onClick={() => onOpen?.()}
        disabled={onOpen === null}
      />
    </div>
  );
}
