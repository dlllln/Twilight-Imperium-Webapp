import {
  Ban,
  Coins,
  Crosshair,
  Crown,
  Flag,
  FlaskConical,
  Gem,
  Hammer,
  Handshake,
  Landmark,
  type LucideIcon,
  Megaphone,
  Puzzle,
  Radar,
  Repeat,
  Rocket,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { ART_HEIGHT, ART_WIDTH, type CardLook, specksOf, tiltOf } from '../../hand/card-look.ts';

const ICONS: Readonly<Record<CardLook, LucideIcon>> = {
  leadership: Megaphone,
  diplomacy: Handshake,
  politics: Landmark,
  construction: Hammer,
  trade: Coins,
  warfare: Swords,
  technology: FlaskConical,
  imperial: Crown,
  tactical: Crosshair,
  pass: Flag,
  swift: Zap,
  sensor: Radar,
  combat: Swords,
  shield: Shield,
  invasion: Rocket,
  echo: Repeat,
  veto: Ban,
  relic: Gem,
  fragment: Puzzle,
  legendary: Sparkles,
};

const CENTER_X = ART_WIDTH / 2;
const CENTER_Y = ART_HEIGHT / 2;

/** Bildfenster: Sternfeld und Umlaufbahn in der Kartenfarbe, in der Mitte das Symbol. */
export function CardArt({ look, seed }: { readonly look: CardLook; readonly seed: string }) {
  const Icon = ICONS[look];
  return (
    <span className="hand-art" aria-hidden="true">
      <svg viewBox={`0 0 ${String(ART_WIDTH)} ${String(ART_HEIGHT)}`} preserveAspectRatio="none">
        {specksOf(seed).map((speck, index) => (
          <circle
            key={index}
            className="hand-speck"
            cx={speck.x}
            cy={speck.y}
            r={speck.r}
            opacity={speck.opacity}
          />
        ))}
        <g transform={`rotate(${String(tiltOf(seed))} ${String(CENTER_X)} ${String(CENTER_Y)})`}>
          <ellipse className="hand-orbit" cx={CENTER_X} cy={CENTER_Y} rx={40} ry={11} />
          <ellipse className="hand-orbit faint" cx={CENTER_X} cy={CENTER_Y} rx={30} ry={17} />
        </g>
      </svg>
      <span className="hand-emblem">
        <Icon size={20} strokeWidth={1.8} />
      </span>
    </span>
  );
}

/** Zierrahmen: abgeschrägte Innenkante mit Rauten in den Ecken und oben in der Mitte. */
export function CardFrame(): ReactElement {
  const corners = [
    [9, 9],
    [131, 9],
    [9, 191],
    [131, 191],
    [70, 5],
  ] as const;
  return (
    <svg className="hand-frame" viewBox="0 0 140 200" preserveAspectRatio="none" aria-hidden="true">
      <path d="M13 5H127L135 13V187L127 195H13L5 187V13Z" />
      {corners.map(([x, y]) => (
        <rect
          key={`${String(x)}-${String(y)}`}
          x={x - 2.5}
          y={y - 2.5}
          width={5}
          height={5}
          transform={`rotate(45 ${String(x)} ${String(y)})`}
        />
      ))}
    </svg>
  );
}
