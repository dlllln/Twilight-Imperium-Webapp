import type { ActionTiming, StrategyMechanic } from '@stellar/domain';
import { hashString, seededRandom } from '../render/noise.ts';
import type { HandEntry } from './hand-model.ts';

/*
 * Das Aussehen einer Handkarte als Daten: jede Strategiekarte und jede Art von Aktionskarte hat
 * ihr eigenes Motiv. Die Farbe zum Motiv steht im Stylesheet (`[data-look]`), das Symbol in
 * `CardArt`; die Sterne im Bildfenster entstehen aus der Karte selbst und bleiben stabil.
 */

export type CardLook =
  | 'leadership'
  | 'diplomacy'
  | 'politics'
  | 'construction'
  | 'trade'
  | 'warfare'
  | 'technology'
  | 'imperial'
  | 'tactical'
  | 'pass'
  | 'swift'
  | 'sensor'
  | 'combat'
  | 'shield'
  | 'invasion'
  | 'echo'
  | 'veto';

const STRATEGY_LOOKS: Readonly<Record<StrategyMechanic, CardLook>> = {
  commandTokens: 'leadership',
  diplomacy: 'diplomacy',
  politics: 'politics',
  construction: 'construction',
  trade: 'trade',
  warfare: 'warfare',
  technology: 'technology',
  imperial: 'imperial',
};

/** Aktionskarten sehen nach ihrem Zeitpunkt aus: Kampfkarten rot, Antworten violett usw. */
const TIMING_LOOKS: Readonly<Record<ActionTiming, CardLook>> = {
  action: 'swift',
  afterActivation: 'sensor',
  combatRound: 'combat',
  afterHits: 'shield',
  invasion: 'invasion',
  secondary: 'echo',
  cancel: 'veto',
};

export const strategyLook = (mechanic: StrategyMechanic): CardLook => STRATEGY_LOOKS[mechanic];

export function lookOf(entry: HandEntry): CardLook {
  if (entry.kind === 'pick' || entry.kind === 'strategic') return strategyLook(entry.card.mechanic);
  if (entry.kind === 'action') return TIMING_LOOKS[entry.card.definition.timing];
  return entry.kind;
}

export interface Speck {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly opacity: number;
}

/** Bildfenster in SVG-Einheiten; Sterne, Umlaufbahn und Neigung passen hinein. */
export const ART_WIDTH = 100;
export const ART_HEIGHT = 50;
const SPECKS = 14;
const MAX_RADIUS = 0.9;
const MIN_OPACITY = 0.25;
const MAX_TILT = 40;

/** Sterne im Bildfenster: für dieselbe Karte immer gleich, für jede Karte anders. */
export function specksOf(seed: string): readonly Speck[] {
  const random = seededRandom(hashString(seed));
  return Array.from({ length: SPECKS }, () => ({
    x: random() * ART_WIDTH,
    y: random() * ART_HEIGHT,
    r: (random() + MIN_OPACITY) * MAX_RADIUS,
    opacity: MIN_OPACITY + random() * (1 - MIN_OPACITY),
  }));
}

/** Neigung der Umlaufbahn hinter dem Symbol, zwischen -40° und 40°. */
export const tiltOf = (seed: string): number =>
  (seededRandom(hashString(`${seed}-orbit`))() * 2 - 1) * MAX_TILT;
