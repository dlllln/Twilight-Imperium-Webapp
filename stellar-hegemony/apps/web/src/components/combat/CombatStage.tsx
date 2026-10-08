import type { GameState, SystemId } from '@stellar/domain';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { FLEET_FRAME } from '../../battle/battle-layout.ts';
import { AFTERGLOW_MS, roundDuration, type Shot, shotsOf } from '../../battle/battle-shots.ts';
import {
  type CombatStage as Stage,
  combatStage,
  roundStart,
  stageFire,
  targetsOn,
  withFallen,
} from '../../battle/combat-stage.ts';
import type { CombatLogEvent } from '../../combat-view.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { unitsOf } from '../../unit-stats.ts';
import { BattleCanvas } from '../battle/BattleCanvas.tsx';

interface Replay {
  readonly shown: Stage | null;
  readonly shots: readonly Shot[];
  readonly volley: number;
}

/** Fester Hintergrund je System, damit die Bühne beim erneuten Öffnen gleich aussieht. */
const SEED_BASE = 31;
const SEED_RANGE = 2 ** 31;
const seedOf = (system: SystemId): number =>
  Array.from({ length: system.length }, (_, index) => system.charCodeAt(index)).reduce(
    (seed, code) => (seed * SEED_BASE + code) % SEED_RANGE,
    1,
  );

/**
 * Spielt neue Ereignisse des Protokolls ab: Schüsse der jüngsten Runde, solange zeigt die
 * Bühne auch die dabei zerstörten Schiffe; danach den Stand der Partie.
 */
function useReplay(stage: Stage | null, log: readonly CombatLogEvent[]): Replay {
  const motion = useSettingsStore((state) => state.animations);
  const seen = useRef(roundStart(log));
  const [replay, setReplay] = useState<Replay>({ shown: stage, shots: [], volley: 0 });
  useEffect(() => {
    const fresh = log.slice(seen.current <= log.length ? seen.current : 0);
    seen.current = log.length;
    const shown = stage === null ? null : withFallen(stage, fresh, log);
    const shots = shown === null || !motion ? [] : shotsOf(stageFire(fresh), targetsOn(shown));
    if (shots.length === 0) {
      setReplay((last) => ({ ...last, shown: stage }));
      return;
    }
    setReplay((last) => ({ shown, shots, volley: last.volley + 1 }));
    const timer = window.setTimeout(
      () => setReplay((last) => ({ ...last, shown: stage })),
      roundDuration(shots, AFTERGLOW_MS),
    );
    return () => window.clearTimeout(timer);
  }, [stage]); // Nur ein neuer Stand der Partie startet eine Wiedergabe.
  return replay;
}

/** Die Kampfbühne des Simulators für den Raumkampf in der Partie. */
export function CombatStage(props: {
  readonly game: GameState;
  readonly system: SystemId;
  readonly log: readonly CombatLogEvent[];
}): ReactElement | null {
  const { game, system, log } = props;
  const stage = useMemo(() => combatStage(game, system, log, unitsOf(game)), [game, system, log]);
  const { shown, shots, volley } = useReplay(stage, log);
  if (shown === null) return null;
  return (
    <div className="combat-stage">
      <BattleCanvas
        left={shown.left.side}
        right={shown.right.side}
        shots={shots}
        volley={volley}
        seed={seedOf(system)}
        frame={FLEET_FRAME}
      />
    </div>
  );
}
