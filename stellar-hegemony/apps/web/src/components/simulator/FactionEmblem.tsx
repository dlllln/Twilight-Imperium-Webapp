import { FACTIONS } from '@stellar/content';
import { type ReactElement, useState } from 'react';
import { factionArtwork } from '../../artwork/factions.ts';
import '../../artwork/factions.css';
import { hashString } from '../../render/noise.ts';
import { seatColor } from '../../seat-colors.ts';

const MIN_POINTS = 3;
const POINT_RANGE = 5;
const CENTER = 50;
const OUTER = 30;
const INNER = 13;

/** Farbe einer Fraktion: die Platzfarbe ihrer Position in der Liste. */
export const factionColor = (id: string): string =>
  seatColor(FACTIONS.findIndex((faction) => faction.id === id) + 1);

/** Sternzeichen mit 3 bis 7 Zacken, je Fraktion verschieden. */
function starPoints(id: string): string {
  const hash = hashString(id);
  const points = MIN_POINTS + (hash % POINT_RANGE);
  const turn = ((hash >> 3) % 360) * (Math.PI / 180);
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? OUTER : INNER;
    const angle = turn + (index * Math.PI) / points;
    return `${(CENTER + Math.cos(angle) * radius).toFixed(1)},${(CENTER + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ');
}

function EmblemGradient({ id, color }: { readonly id: string; readonly color: string }) {
  return (
    <defs>
      <radialGradient id={id} cx="50%" cy="38%" r="70%">
        <stop offset="0%" stopColor={color} stopOpacity="0.9" />
        <stop offset="100%" stopColor="#070b1c" />
      </radialGradient>
    </defs>
  );
}

interface EmblemProps {
  readonly id: string;
  readonly size?: number;
}

/** The previous geometric emblem remains available when an image cannot load. */
function FallbackEmblem({ id, size = 64 }: EmblemProps): ReactElement {
  const color = factionColor(id);
  const gradient = `emblem-${id}`;
  return (
    <svg
      className="faction-emblem"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <EmblemGradient id={gradient} color={color} />
      <polygon
        points="50,4 90,27 90,73 50,96 10,73 10,27"
        fill={`url(#${gradient})`}
        stroke={color}
        strokeWidth="3"
      />
      <polygon points={starPoints(id)} fill="#fff6d8" opacity="0.92" />
      <circle cx={CENTER} cy={CENTER} r="6" fill={color} />
    </svg>
  );
}

/** Authentic Twilight Imperium faction symbol, shared by chooser, HUD and simulator. */
export function FactionEmblem({ id, size = 64 }: EmblemProps): ReactElement {
  const artwork = factionArtwork(id);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  if (artwork === undefined || failedImage === artwork.icon)
    return <FallbackEmblem id={id} size={size} />;
  return (
    <img
      className="faction-emblem ti4-faction-emblem"
      src={artwork.icon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      onError={() => setFailedImage(artwork.icon)}
    />
  );
}
