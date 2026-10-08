import { LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import type { ReactElement } from 'react';
import { useT } from '../use-translation.ts';
import { IconButton } from './ui/IconButton.tsx';

/** Schwebende Kartensteuerung: zoomen und zurücksetzen; tief genug hinein öffnet ein System. */
export function MapControls({
  onZoom,
  onReset,
}: {
  readonly onZoom: (factor: number) => void;
  readonly onReset: () => void;
}): ReactElement {
  const t = useT();
  return (
    <div className="map-controls glass" role="toolbar" aria-label={t('systemHint')}>
      <IconButton icon={ZoomIn} label={t('zoomIn')} onClick={() => onZoom(ZOOM_STEP)} />
      <IconButton icon={ZoomOut} label={t('zoomOut')} onClick={() => onZoom(1 / ZOOM_STEP)} />
      <IconButton icon={LocateFixed} label={t('resetView')} onClick={onReset} />
    </div>
  );
}

export const ZOOM_STEP = 1.25;
