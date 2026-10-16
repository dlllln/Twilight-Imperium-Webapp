import { officialLeader } from '@stellar/content';
import type { CardArtworkSource } from './cards.ts';

/** No substitute from another faction or card deck when a leader is unknown. */
export function leaderFrame(id: string): CardArtworkSource | undefined {
  const leader = officialLeader(id);
  return leader === undefined
    ? undefined
    : {
        path: `/ti4/${leader.card}`,
        columns: 1,
        rows: 1,
        index: 0,
      };
}

/** The character portrait occupies the left third of a printed leader card. */
export function leaderArtwork(id: string): CardArtworkSource | undefined {
  const frame = leaderFrame(id);
  return frame === undefined
    ? undefined
    : {
        ...frame,
        crop: { x: 0.02, y: 0.27, width: 0.36, height: 0.7 },
      };
}
