import { type ReactElement, useId } from 'react';

/*
 * Der Sprechermarker als eigenes, prozedurales Bild: eine achteckige Messingscheibe mit einem
 * Ring in der Sitzfarbe (`--seat` des umgebenden Elements) und einem Hammer darauf. Rein
 * dekorativ; Name und Zustand nennt immer das Element, das die Scheibe trägt.
 */

/** Ecken eines regelmäßigen Achtecks um die Mitte (32, 32). */
function octagon(radius: number): string {
  const corners = Array.from({ length: 8 }, (_, index) => {
    const angle = Math.PI / 8 + (index * Math.PI) / 4;
    const x = 32 + radius * Math.cos(angle);
    const y = 32 + radius * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return corners.join(' ');
}

const OUTER = octagon(30);
const INNER = octagon(23);

/** Der Hammer: Kopf quer, Stiel schräg nach unten rechts, darunter der Klangblock. */
function Gavel(): ReactElement {
  return (
    <g className="speaker-gavel" fill="#3b2a12" stroke="#f6e3a8" strokeWidth="0.8">
      <rect x="18" y="20" width="18" height="8" rx="2" transform="rotate(-35 27 24)" />
      <rect x="29" y="27" width="4" height="18" rx="1.5" transform="rotate(-35 31 36)" />
      <rect x="30" y="43" width="16" height="4" rx="1.5" />
    </g>
  );
}

export function SpeakerFace({ className }: { readonly className?: string }): ReactElement {
  // Doppelpunkte aus `useId` würden den Verweis `url(#…)` brechen.
  const brass = `speaker-brass-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg
      className={className === undefined ? 'speaker-face' : `speaker-face ${className}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={brass} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fbe7a1" />
          <stop offset="55%" stopColor="#c9962f" />
          <stop offset="100%" stopColor="#6e4b14" />
        </radialGradient>
      </defs>
      <polygon points={OUTER} fill="var(--seat, #c9962f)" />
      <polygon points={octagon(27)} fill={`url(#${brass})`} stroke="#5a3d10" strokeWidth="1" />
      <polygon points={INNER} fill="none" stroke="#fff3c4" strokeOpacity="0.55" strokeWidth="1" />
      <Gavel />
    </svg>
  );
}
