import { type GameState, type PlanetId, planetId } from '@stellar/domain';
import { memo, type ReactElement } from 'react';
import type { BoardView } from '../../render/board-view.ts';
import type { SceneHex } from '../../render/scene-model.ts';
import { type PlanetAnchor, planetAnchors } from '../../system/map-anchors.ts';
import { planetStates } from '../../table/planet-table.ts';
import { planetTarget, targetKey, type TargetState } from '../../table/target-ref.ts';
import { usePlanetTable } from '../../table/use-planet-table.ts';
import { useT } from '../../use-translation.ts';
import './planet-targets.css';

/*
 * Planeten auf der Karte als Ziele: Während einer Bezahlung oder beim Bereitmachen leuchten die
 * angebotenen eigenen Planeten, ein Tippen merkt sie vor wie die Karten der Planetenreihe. Die
 * Ringe sind nur eine Abkürzung für Zeiger und Finger; Tastatur und Bildschirmleser bedienen
 * dieselbe Wahl über die Planetenreihe, darum sind sie für Hilfsmittel unsichtbar.
 */

/** Merkt einen Planeten vor oder gibt ihn frei. */
export type PlanetHandler = (planet: PlanetId) => void;

export interface PlanetTargetsProps {
  readonly game: GameState;
  readonly hexes: readonly SceneHex[];
  readonly view: BoardView;
  /** Ohne eigenen Handler schaltet ein Klick direkt am Tisch um (ohne Schutz vor Ziehen). */
  readonly onPlanet?: PlanetHandler | undefined;
}

/** Kleinster Ring in Brettkoordinaten, damit ihn auch ein Finger sicher trifft. */
const MIN_RADIUS = 12;
/** Der Ring liegt knapp außerhalb des Planetenrands. */
const RING_GAP = 3;

interface PlanetTarget {
  readonly anchor: PlanetAnchor;
  readonly id: PlanetId;
  readonly state: 'legal' | 'chosen';
}

const shown = (state: TargetState | undefined): state is 'legal' | 'chosen' =>
  state === 'legal' || state === 'chosen';

/** Alle angebotenen oder gewählten Planeten der Karte samt Ankerpunkt. */
function targetsOf(
  hexes: readonly SceneHex[],
  view: BoardView,
  states: ReadonlyMap<string, TargetState>,
): PlanetTarget[] {
  return hexes.flatMap((hex) =>
    planetAnchors(hex, view).flatMap((anchor) => {
      const id = planetId(anchor.planet.id);
      const state = states.get(targetKey(planetTarget(id)));
      return shown(state) ? [{ anchor, id, state }] : [];
    }),
  );
}

interface RingProps {
  readonly target: PlanetTarget;
  readonly value: number;
  readonly onPlanet: PlanetHandler;
}

/** Ein Ring um den Planeten: gestrichelt in Platzfarbe, vorgemerkt golden. */
function PlanetRing({ target, value, onPlanet }: RingProps): ReactElement {
  const t = useT();
  const { anchor, id, state } = target;
  const name = anchor.planet.name;
  return (
    <circle
      className={`planet-target target-${state}`}
      cx={anchor.at.x}
      cy={anchor.at.y}
      r={Math.max(MIN_RADIUS, anchor.radius + RING_GAP)}
      data-target={targetKey(planetTarget(id))}
      data-target-state={state}
      data-value={value}
      data-planet={id}
      aria-hidden="true"
      onClick={() => onPlanet(id)}
    >
      <title>{state === 'chosen' ? `${name} · ${t('planetMarked')}` : name}</title>
    </circle>
  );
}

/**
 * Ringe über den angebotenen Planeten, in derselben Ebene wie die Felder und über ihnen.
 * `memo`: Schwenken und Zoomen zeichnen sie nicht neu.
 */
export const PlanetTargets = memo(function PlanetTargets({
  game,
  hexes,
  view,
  onPlanet,
}: PlanetTargetsProps): ReactElement | null {
  const table = usePlanetTable(game);
  if (table === null) return null;
  const pick = onPlanet ?? table.toggle;
  return (
    <g className="planet-targets">
      {targetsOf(hexes, view, planetStates(table)).map((target) => (
        <PlanetRing
          key={target.id}
          target={target}
          value={table.values.get(target.id) ?? 0}
          onPlanet={pick}
        />
      ))}
    </g>
  );
});
