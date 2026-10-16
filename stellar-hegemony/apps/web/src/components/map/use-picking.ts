import { type SystemId, systemId } from '@stellar/domain';
import { useGameStore } from '../../game-store.ts';
import type { SceneHex } from '../../render/scene-model.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { systemTarget, targetKey } from '../../table/target-ref.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';

/** Kriegsführung: ein System, das die Entscheidung als Ziel führt, gibt seinen Marker her. */
function warfareSystem(decision: TableDecision | null, hex: SceneHex): SystemId | null {
  if (decision?.specId !== 'warfare' || hex.systemId === null) return null;
  const system = systemId(hex.systemId);
  return decision.targets.has(targetKey(systemTarget(system))) ? system : null;
}

/**
 * In der Partie wählt ein Klick das System und zeigt seine Knöpfe; ein zweiter Klick fährt
 * heran. Vor der Partie fährt schon der erste Klick heran. Wer die Karte zieht, verschiebt sie nur.
 * Während der Kriegsführung nimmt ein Klick auf ein System mit eigenem Marker diesen Marker.
 */
export function usePicking(wasDrag: () => boolean, flyTo: (hex: SceneHex) => void) {
  const decision = useTableDecision(useGameStore((state) => state.game));
  return (hex: SceneHex) => {
    if (wasDrag()) return;
    useSettingsStore.getState().markHintSeen();
    const warfare = warfareSystem(decision, hex);
    if (warfare !== null) {
      decision?.act({ kind: 'system', system: warfare });
      return;
    }
    const { game, selected, select } = useGameStore.getState();
    if (game === null || hex.systemId === selected) flyTo(hex);
    else select(hex.systemId);
  };
}
