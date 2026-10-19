import { AnimatePresence, motion, type MotionStyle, type Variants } from 'motion/react';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import type { SheetZone } from '../../hud/sheet-model.ts';
import type { SheetPulse } from '../../hud/use-sheet.ts';
import { hashString } from '../../render/noise.ts';
import { useSettingsStore } from '../../settings-store.ts';

/*
 * Spielsteine auf dem Kommandopult: achteckige Kommandomarker, goldene Rautenmünzen,
 * Rohstoffkisten und die Vertiefungen, in denen sie liegen. Alles eigene, prozedurale Formen.
 */

export const SPRING = { type: 'spring', stiffness: 320, damping: 26 } as const;
/** Neue Steine fallen von oben auf das Pult. */
export const ENTER = { y: -28, scale: 1.3, opacity: 0 } as const;
const REST = { y: 0, scale: 1, opacity: 1 } as const;
/** Ein Marker, der auf die Karte geht, hebt ab und verblasst. */
export const LEAVE_TO_MAP = { y: -60, opacity: 0, scale: 1.3 } as const;
/** Wandert ein Marker in ein anderes Feld, fliegt sein Nachfolger dorthin; er selbst verschwindet sofort. */
const MOVED = { opacity: 0, transition: { duration: 0 } } as const;
const POP_IN = { y: -18, scale: 0.4, opacity: 0 } as const;
const POP_OUT = { y: -26, scale: 0.6, opacity: 0 } as const;

const CENTER = 20;
const RADIUS = 18.5;
const INNER = 12.5;
const SIDES = 8;
const GLYPH_OUTER = 7.6;
const GLYPH_INNER = 3.2;
/** Mindestens zwei gegenüberliegende Kerben, damit jeder Marker als Marker erkennbar bleibt. */
const NOTCH_BASE = 0b00010001;

const fmt = (value: number): string => value.toFixed(2);
const at = (angle: number, radius: number): string =>
  `${fmt(CENTER + Math.cos(angle) * radius)},${fmt(CENTER + Math.sin(angle) * radius)}`;

/** Regelmäßiges Achteck mit waagrechter Ober- und Unterkante. */
const octagon = (radius: number): string =>
  Array.from({ length: SIDES }, (_, k) =>
    at(Math.PI / SIDES + (k * 2 * Math.PI) / SIDES, radius),
  ).join(' ');

const OUTER_POINTS = octagon(RADIUS);
const INNER_POINTS = octagon(INNER);
const APOTHEM = RADIUS * Math.cos(Math.PI / SIDES);

/** Kerben am Rand: welche der acht Kanten eine Kerbe trägt, folgt aus der Fraktion. */
function notches(hash: number): string {
  const mask = (hash & 0xff) | NOTCH_BASE;
  return Array.from({ length: SIDES }, (_, k) => k)
    .filter((k) => (mask >> k) & 1)
    .map((k) => {
      const angle = (k * 2 * Math.PI) / SIDES;
      return `M${at(angle, APOTHEM - 4.4)}L${at(angle, APOTHEM - 0.2)}`;
    })
    .join('');
}

/**
 * Eingravierter Stern in der Mitte: drei bis sechs Zacken, je Fraktion gedreht.
 * Vorzeichenlos verschieben: der Hash ist eine vorzeichenlose 32-Bit-Zahl.
 */
function glyph(hash: number): string {
  const points = 3 + ((hash >>> 8) % 4);
  const turn = ((hash >>> 12) % 360) * (Math.PI / 180);
  return Array.from({ length: points * 2 }, (_, index) =>
    at(turn + (index * Math.PI) / points, index % 2 === 0 ? GLYPH_OUTER : GLYPH_INNER),
  ).join(' ');
}

/** Ein Kommandomarker: Achteck in Platzfarbe mit Kante, Glanz, Kerben und Stern. */
export function CommandToken({ faction }: { readonly faction: string }): ReactElement {
  const marks = useMemo(() => {
    const hash = hashString(faction);
    return { notches: notches(hash), glyph: glyph(hash) };
  }, [faction]);
  return (
    <svg className="token-svg" viewBox="0 0 40 40" aria-hidden="true">
      <polygon className="token-edge" points={OUTER_POINTS} transform="translate(0 1.6)" />
      <polygon className="token-face" points={OUTER_POINTS} />
      <polygon className="token-sheen" points={OUTER_POINTS} fill="url(#sheet-sheen)" />
      <polygon className="token-inner" points={INNER_POINTS} />
      <path className="token-notch" d={marks.notches} />
      <polygon className="token-glyph-light" points={marks.glyph} transform="translate(0 0.7)" />
      <polygon className="token-glyph" points={marks.glyph} />
    </svg>
  );
}

/** Verläufe, die alle Steine teilen; einmal je Pult. */
export function SheetDefs(): ReactElement {
  return (
    <svg className="sheet-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sheet-sheen" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id="sheet-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff1b8" />
          <stop offset="45%" stopColor="#e7bf55" />
          <stop offset="100%" stopColor="#8a6420" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Federn, solange Animationen an sind; sonst springt alles sofort an seinen Platz. */
export function useSheetTransition() {
  const animations = useSettingsStore((state) => state.animations);
  return animations ? SPRING : { duration: 0 };
}

/** Ausgang je Marker: auf die Karte abheben oder (beim Wechsel ins nächste Feld) sofort weg. */
const chipVariants = (id: number): Variants => ({
  leave: (onMap: ReadonlySet<number>) => (onMap.has(id) ? LEAVE_TO_MAP : MOVED),
});

interface ChipProps {
  readonly id: number;
  /** Feld des Markers; „loose“ ist die Schale „Neue Marker“ während einer Verteilung. */
  readonly zone: SheetZone | 'loose';
  readonly faction: string;
  /** Kommt von der Karte zurück: fällt von oben ins Feld. */
  readonly arriving: boolean;
  readonly place: MotionStyle;
  /** Wird gerade gezogen: bleibt blass an seinem Platz, bis er abgelegt ist. */
  readonly dragging?: boolean;
}

/** Ein Marker mit fester Nummer; wechselt er das Feld, fliegt er per `layoutId` hinüber. */
export function TokenChip(props: ChipProps): ReactElement {
  const { id, zone, faction, arriving, place, dragging = false } = props;
  const transition = useSheetTransition();
  return (
    <motion.span
      className="sheet-token"
      data-zone={zone}
      data-token={id}
      data-dragging={dragging ? 'true' : undefined}
      layoutId={`cmd-${String(id)}`}
      variants={chipVariants(id)}
      initial={arriving ? ENTER : false}
      animate={REST}
      exit="leave"
      transition={transition}
      style={place}
    >
      <CommandToken faction={faction} />
    </motion.span>
  );
}

/** Lage jeder Münze im Haufen (waagrecht, Höhe in px): unten breit, nach oben spitz. */
const COIN_SPOTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-15, 1],
  [15, 1],
  [-8, 7],
  [8, 7],
  [0, 13],
  [-29, 2],
  [29, 2],
  [-21, 8],
  [21, 8],
];

/** Die Rautenmünze selbst; auch der Geist einer getragenen Handelsware zeigt sie. */
export function CoinFace(): ReactElement {
  return (
    <svg className="coin-svg" viewBox="0 0 26 16" aria-hidden="true">
      <polygon className="coin-edge" points="13,2.4 25.2,9.4 13,16 0.8,9.4" />
      <polygon
        className="coin-face"
        points="13,0.8 25.2,7.8 13,14.6 0.8,7.8"
        fill="url(#sheet-gold)"
      />
      <polygon className="coin-inner" points="13,4 19.4,7.8 13,11.4 6.6,7.8" />
      <path className="coin-shine" d="M6.5 6.2 L12.6 2.6" />
    </svg>
  );
}

/** Goldene Rautenmünze; `index` legt ihren Platz im Haufen fest. */
export function Coin({ index }: { readonly index: number }): ReactElement {
  const transition = useSheetTransition();
  const [x, y] = COIN_SPOTS[index % COIN_SPOTS.length] ?? [0, 0];
  return (
    <motion.span
      className="sheet-coin"
      style={{ '--x': `${String(x)}px`, '--y': `${String(y)}px`, zIndex: index } as MotionStyle}
      initial={POP_IN}
      animate={REST}
      exit={POP_OUT}
      transition={transition}
    >
      <CoinFace />
    </motion.span>
  );
}

/** Rohstoffkiste in Türkis, von schräg oben gesehen. */
export function Crate(): ReactElement {
  const transition = useSheetTransition();
  return (
    <motion.span
      className="sheet-crate"
      initial={POP_IN}
      animate={REST}
      exit={POP_OUT}
      transition={transition}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polygon className="crate-left" points="2,7 12,12 12,22.5 2,17.5" />
        <polygon className="crate-right" points="12,12 22,7 22,17.5 12,22.5" />
        <polygon className="crate-top" points="12,1.6 22,7 12,12 2,7" />
        <path className="crate-slat" d="M2 12.2 L12 17.2 L22 12.2 M7 4.3 L17 9.5" />
      </svg>
    </motion.span>
  );
}

interface SocketProps {
  readonly column?: number;
  readonly children?: ReactNode;
}

/** Eingelassene Vertiefung im Pult, in der ein Stein liegt (oder fehlt). */
export function Socket({ column, children }: SocketProps): ReactElement {
  const style = column === undefined ? undefined : { gridColumn: column, gridRow: 1 };
  return (
    <span className="sheet-socket" style={style}>
      {children}
    </span>
  );
}

/** Rohstoffkiste in ihrer Vertiefung; erscheint und verschwindet mit kleinem Sprung. */
export function CrateSocket({ filled }: { readonly filled: boolean }): ReactElement {
  return (
    <Socket>
      <AnimatePresence initial={false}>{filled && <Crate key="crate" />}</AnimatePresence>
    </Socket>
  );
}

const signed = (value: number): string =>
  value > 0 ? `+${String(value)}` : `−${String(Math.abs(value))}`;

/** Kurz aufleuchtende Änderung über dem Feld, z. B. „+2“ oder „−1“. */
export function SheetDelta({
  zone,
  pulse,
}: {
  readonly zone: SheetZone | 'victoryPoints';
  readonly pulse: SheetPulse;
}): ReactElement | null {
  const change = pulse.changes[zone];
  if (pulse.serial === 0 || change === undefined || change === 0) return null;
  return (
    <span
      key={`${String(pulse.serial)}-${zone}`}
      className={change > 0 ? 'sheet-delta up' : 'sheet-delta down'}
      aria-hidden="true"
    >
      {signed(change)}
    </span>
  );
}
