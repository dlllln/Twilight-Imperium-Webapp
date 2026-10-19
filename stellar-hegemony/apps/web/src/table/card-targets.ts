import { type ActionTarget, COMMAND_POOLS, type TargetOptions } from '@stellar/domain';
import {
  playerTarget,
  poolTarget,
  siteTarget,
  systemTarget,
  type TargetRef,
  targetKey,
} from './target-ref.ts';

/*
 * Ziele einer Aktionskarte als reine Daten: was die Domain anbietet (`TargetOptions`), als
 * Schlüssel der Tischziele, und was ein Ablegen der Karte auf einem dieser Ziele als
 * `ActionTarget` bedeutet. Das Formular in der Hand und das Ablegen am Tisch teilen sich die
 * Vorauswahl, damit beide Wege dieselbe Karte gleich ausspielen.
 */

/** Vorauswahl: jeweils die erste zugelassene Möglichkeit, damit die Karte sofort spielbar ist. */
export function initialTarget(options: TargetOptions): ActionTarget {
  const planet = options.planets?.options[0];
  const system = options.systems?.[0];
  const player = options.players?.[0];
  return {
    ...(planet === undefined ? {} : { planets: [planet] }),
    ...(system === undefined ? {} : { system }),
    ...(player === undefined ? {} : { player }),
    ...(options.pool === undefined ? {} : { pool: 'tactic' as const }),
  };
}

export const hasTargets = (options: TargetOptions): boolean =>
  Object.values(options).some((option) => option !== undefined);

/** Verlangte Planeten müssen gewählt sein; alle anderen Felder sind immer belegt. */
export const targetComplete = (options: TargetOptions, target: ActionTarget): boolean =>
  options.planets === undefined || (target.planets ?? []).length > 0;

/**
 * Ob ein einziges Ablegen die Karte vollständig ausspielt. Eine Karte, die mehrere Planeten
 * nimmt (Reaktivierung: bis zu zwei), bliebe mit dem einen getroffenen Planeten halb wirkungslos;
 * sie geht über die Zielwahl an der Karte, nicht über das Ziehen.
 */
export const playsByDrop = (options: TargetOptions): boolean =>
  hasTargets(options) && (options.planets?.max ?? 1) <= 1;

/** Alle Tischziele, auf die die Karte gelegt werden darf. */
export function cardTargetKeys(options: TargetOptions): ReadonlySet<string> {
  const refs: readonly TargetRef[] = [
    ...(options.planets?.options ?? []).map(siteTarget),
    ...(options.systems ?? []).map(systemTarget),
    ...(options.players ?? []).map(playerTarget),
    ...(options.pool === undefined ? [] : COMMAND_POOLS.map(poolTarget)),
  ];
  return new Set(refs.map(targetKey));
}

/** Das Feld des Ziels, das ein abgelegtes Stück belegt; `null`, wenn es keines ist. */
function fieldOf(dropped: TargetRef): ActionTarget | null {
  switch (dropped.kind) {
    case 'site':
      return { planets: [dropped.id] };
    case 'system':
      return { system: dropped.id };
    case 'player':
      return { player: dropped.id };
    case 'pool':
      return dropped.pool === 'loose' ? null : { pool: dropped.pool };
    default:
      return null;
  }
}

/**
 * Die Karte auf ein Ziel gelegt: die Vorauswahl, darin das getroffene Feld ersetzt. `null`,
 * wenn die Karte dieses Ziel nicht anbietet oder sich nicht mit einem Ablegen spielen lässt.
 */
export function cardDropTarget(options: TargetOptions, dropped: TargetRef): ActionTarget | null {
  const field = fieldOf(dropped);
  if (field === null || !playsByDrop(options)) return null;
  if (!cardTargetKeys(options).has(targetKey(dropped))) return null;
  return { ...initialTarget(options), ...field };
}
