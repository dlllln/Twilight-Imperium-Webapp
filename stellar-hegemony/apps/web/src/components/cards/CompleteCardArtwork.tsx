import { useState } from 'react';
import { cardImageStyle, type CardArtworkSource } from '../../artwork/cards.ts';
import '../../artwork/cards.css';

/** One complete printed card, preserving the cell's natural aspect ratio. */
export function CompleteCardArtwork({ artwork }: { readonly artwork: CardArtworkSource }) {
  const [ratio, setRatio] = useState(2 / 3);
  const fullCard = { ...artwork, crop: { x: 0, y: 0, width: 1, height: 1 } };
  return (
    <span className="ti4-complete-card" aria-hidden="true" style={{ aspectRatio: ratio }}>
      <img
        src={artwork.path}
        alt=""
        draggable={false}
        style={cardImageStyle(fullCard)}
        onLoad={({ currentTarget }) =>
          setRatio(
            currentTarget.naturalWidth /
              artwork.columns /
              (currentTarget.naturalHeight / artwork.rows),
          )
        }
      />
    </span>
  );
}
