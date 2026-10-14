import type { ReactElement } from 'react';
import { cardImageStyle, type CardArtworkSource } from '../../artwork/cards.ts';
import '../../artwork/cards.css';

/** Decorative original artwork; game names, effects and controls remain real HTML. */
export function CardArtwork({
  artwork,
  className = '',
}: {
  readonly artwork: CardArtworkSource;
  readonly className?: string;
}): ReactElement {
  return (
    <span className={`ti4-card-artwork ${className}`} aria-hidden="true">
      <img src={artwork.path} alt="" draggable={false} style={cardImageStyle(artwork)} />
    </span>
  );
}
