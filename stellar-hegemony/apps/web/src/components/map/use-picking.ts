import { type PlanetId, type SystemId, systemId } from '@stellar/domain';
import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../../game-store.ts';
import { useOnlineStore } from '../../online/online-store.ts';
import type { SceneHex } from '../../render/scene-model.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { systemTarget, targetKey } from '../../table/target-ref.ts';
import { takesSystem } from '../../table/table-specs.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { usePlanetTable } from '../../table/use-planet-table.ts';

/**
 * Ein System, das die Entscheidung als Ziel führt: Bei der Kriegsführung gibt es seinen Marker
 * her, bei der Diplomatie (primär) wird es das gewählte System.
 */
function draftSystem(decision: TableDecision | null, hex: SceneHex): SystemId | null {
  if (decision === null || !takesSystem(decision.specId) || hex.systemId === null) return null;
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
 * Während der Kriegsführung nimmt ein Klick auf ein System mit eigenem Marker diesen Marker, bei
 * der Diplomatie (primär) nimmt er ein leuchtendes System in den Entwurf.
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
      const system = draftSystem(latest.current, hex);
      if (system === null) selectOrFly(hex, flyTo);
      else latest.current?.act({ kind: 'system', system });
    },
    [wasDrag, flyTo, latest],
  );
}

/** Die jeweils angebotenen Planeten, ohne dass sich die Klick-Funktion bei jedem Zeichnen ändert. */
function useLatestPlanets() {
  const table = usePlanetTable(useGameStore((state) => state.game));
  const latest = useRef(table);
  useEffect(() => {
    latest.current = table;
  });
  return latest;
}

/**
 * Ein Klick auf einen angebotenen Planeten merkt ihn vor oder gibt ihn frei, im selben Entwurf
 * wie die Planetenreihe. Wer dabei die Karte zieht, verschiebt sie nur.
 */
export function usePlanetPicking(wasDrag: () => boolean): (planet: PlanetId) => void {
  const latest = useLatestPlanets();
  return useCallback(
    (planet: PlanetId) => {
      if (!wasDrag()) latest.current?.toggle(planet);
    },
    [wasDrag, latest],
  );
}

/**
 * Ein Klick auf einen Planeten als Ziel (Bombardement, Landung, Infrastruktur) gibt ihm die
 * nächste Figur bzw. setzt oder nimmt ein Gebäude. Wer dabei die Karte zieht, verschiebt sie nur.
 */
export function useSitePicking(wasDrag: () => boolean): (planet: PlanetId) => void {
  const latest = useLatestDecision();
  return useCallback(
    (planet: PlanetId) => {
      if (!wasDrag()) latest.current?.act({ kind: 'site', planet });
    },
    [wasDrag, latest],
  );
}
