import { type SystemId, systemId } from '@stellar/domain';
import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../../game-store.ts';
import { useOnlineStore } from '../../online/online-store.ts';
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

/** Die jeweils letzte Entscheidung, ohne dass sich die Klick-Funktion bei jedem Zeichnen ändert. */
function useLatestDecision() {
  const decision = useTableDecision(useGameStore((state) => state.game));
  const latest = useRef(decision);
  useEffect(() => {
    latest.current = decision;
  });
  return latest;
}

/** Wählen oder Heranfahren: in der Partie wählt der erste Klick, der zweite fährt heran. */
function selectOrFly(hex: SceneHex, flyTo: (hex: SceneHex) => void): void {
  const { game, selected, select } = useGameStore.getState();
  if (game === null || hex.systemId === selected) flyTo(hex);
  else select(hex.systemId);
}

/**
 * In der Partie wählt ein Klick das System und zeigt seine Knöpfe; ein zweiter Klick fährt
 * heran. Vor der Partie fährt schon der erste Klick heran. Wer die Karte zieht, verschiebt sie nur.
 * Mit gedrückter Umschalttaste zeigt ein Klick den Mitspielern das System (Ping).
 * Während der Kriegsführung nimmt ein Klick auf ein System mit eigenem Marker diesen Marker.
 */
export function usePicking(wasDrag: () => boolean, flyTo: (hex: SceneHex) => void) {
  const latest = useLatestDecision();
  return useCallback(
    (hex: SceneHex, point = false) => {
      if (wasDrag()) return;
      if (point && hex.systemId !== null) {
        void useOnlineStore.getState().pingSystem(hex.systemId);
        return;
      }
      useSettingsStore.getState().markHintSeen();
      const warfare = warfareSystem(latest.current, hex);
      if (warfare === null) selectOrFly(hex, flyTo);
      else latest.current?.act({ kind: 'system', system: warfare });
    },
    [wasDrag, flyTo, latest],
  );
}
