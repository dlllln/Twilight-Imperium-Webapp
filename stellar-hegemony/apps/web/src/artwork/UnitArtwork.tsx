import type { ReactElement } from 'react';
import {
  fallbackShipImage,
  fallbackUnitImage,
  replaceBrokenUnitImage,
  shipImage,
  unitImage,
} from '../render/images.ts';

/** Shared DOM miniature; the name and live gameplay values remain beside the image. */
export function UnitArtwork({
  type,
  seat,
  large = false,
}: {
  readonly type: string;
  readonly seat: number;
  readonly large?: boolean;
}): ReactElement | null {
  const src = large ? shipImage(type, seat) : unitImage(type, seat);
  if (src === null) return null;
  const fallback = () => (large ? fallbackShipImage(type, seat) : fallbackUnitImage(type, seat));
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      data-ti4-unit={type}
      onError={(event) => replaceBrokenUnitImage(event.currentTarget, fallback())}
    />
  );
}
