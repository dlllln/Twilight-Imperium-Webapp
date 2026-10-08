import type { HitAssignment, PlayerId, Volley } from '@stellar/domain';

/*
 * Choreografie einer Kampfrunde: Aus den Würfen wird eine Folge von Schüssen. Treffer
 * gehen an die Schiffe, die laut Zuweisung zerstört oder beschädigt werden; abgewehrte
 * Treffer prallen an Schilden ab; Fehlschüsse verfehlen ein beliebiges Ziel. Fehlt die
 * Zuweisung noch, schlagen Treffer nur ein.
 */

/** `hit`: getroffen, aber noch nicht zugewiesen (in der Partie wählt der Spieler danach). */
export type ShotOutcome = 'destroy' | 'damage' | 'hit' | 'blocked' | 'miss';

export interface Shot {
  readonly from: string;
  readonly to: string;
  readonly outcome: ShotOutcome;
  /** Millisekunden nach Beginn der Runde. */
  readonly delay: number;
}

export interface RoundFire {
  readonly barrage: readonly { readonly volley: Volley; readonly destroyed: readonly string[] }[];
  readonly volleys: readonly Volley[];
  readonly assignments: readonly (HitAssignment & { readonly player: PlayerId })[];
}

/** Abstand zweier Schüsse derselben Salve und Pause nach der Jägerabwehr. */
export const SHOT_STEP_MS = 140;
/** So lange wirken Explosion und Rauch nach dem letzten Schuss nach. */
export const AFTERGLOW_MS = 1300;
const BARRAGE_PAUSE_MS = 500;
/** Streut Fehlschüsse über die gegnerische Flotte, ohne Zufall. */
const SPREAD = 7;

type Targets = (player: PlayerId) => readonly string[];
type Queue = readonly { id: string; outcome: ShotOutcome }[] | null;

const results = (volley: Volley) =>
  volley.rolls.flatMap((roll) =>
    roll.results.map((value) => ({ from: roll.unit, hit: value >= roll.hitOn })),
  );

/** Ziele der Treffer in Reihenfolge: zuerst die zerstörten, dann die beschädigten Schiffe. */
function hitQueue(fire: RoundFire, player: PlayerId): Queue {
  const assignment = fire.assignments.find((entry) => entry.player === player);
  if (assignment === undefined) return null;
  return [
    ...assignment.destroyed.map((id) => ({ id: id, outcome: 'destroy' as const })),
    ...assignment.sustained.map((id) => ({ id: id, outcome: 'damage' as const })),
  ];
}

function volleyShots(volley: Volley, queue: Queue, targets: Targets, start: number) {
  const pool = targets(volley.target);
  let hitIndex = 0;
  return results(volley).flatMap(({ from, hit }, index): Shot[] => {
    const fallback = pool[(index * SPREAD) % Math.max(1, pool.length)];
    const delay = start + index * SHOT_STEP_MS;
    if (!hit) return fallback === undefined ? [] : [{ from, to: fallback, outcome: 'miss', delay }];
    const target = queue?.[hitIndex++];
    if (target !== undefined) return [{ from, to: target.id, outcome: target.outcome, delay }];
    const outcome = queue === null ? 'hit' : 'blocked';
    return fallback === undefined ? [] : [{ from, to: fallback, outcome, delay }];
  });
}

const barrageQueue = (destroyed: readonly string[]) =>
  destroyed.map((id) => ({ id, outcome: 'destroy' as const }));

/** Alle Schüsse einer Runde: erst die Jägerabwehr, dann beide Salven gleichzeitig. */
export function shotsOf(fire: RoundFire, targets: Targets): readonly Shot[] {
  const barrage = fire.barrage.flatMap((entry) =>
    volleyShots(entry.volley, barrageQueue(entry.destroyed), targets, 0),
  );
  const start =
    barrage.length === 0 ? 0 : BARRAGE_PAUSE_MS + Math.max(...barrage.map((s) => s.delay));
  const main = fire.volleys.flatMap((volley, index) =>
    volleyShots(volley, hitQueue(fire, volley.target), targets, start + (index * SHOT_STEP_MS) / 2),
  );
  return [...barrage, ...main].sort((a, b) => a.delay - b.delay);
}

/** Wann die letzte Wirkung einer Runde abgeklungen ist. */
export const roundDuration = (shots: readonly Shot[], tail: number): number =>
  shots.length === 0 ? 0 : Math.max(...shots.map((shot) => shot.delay)) + tail;
