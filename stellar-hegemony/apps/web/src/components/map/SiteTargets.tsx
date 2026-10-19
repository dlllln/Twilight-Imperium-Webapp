import { type GameState, type PlanetId, planetId } from '@stellar/domain';
import { type KeyboardEvent, memo, type ReactElement } from 'react';
import type { MessageKey } from '../../i18n.ts';
import type { BoardView } from '../../render/board-view.ts';
import type { SceneHex } from '../../render/scene-model.ts';
import { type PlanetAnchor, planetAnchors } from '../../system/map-anchors.ts';
import type { TableSpecId } from '../../table/table-specs.ts';
import {
  type DropHandler,
  siteTarget,
  targetKey,
  type TargetState,
} from '../../table/target-ref.ts';
import {
  type TableDecision,
  useTableDecision,
  useTableTargets,
} from '../../table/use-table-decision.ts';
import { useCarryStore } from '../../table/carry-store.ts';
import { useDropRouter } from '../../table/use-drop-router.ts';
import { useTarget } from '../../table/use-target.ts';
import { useT } from '../../use-translation.ts';
import './site-targets.css';

/*
 * Planeten als Ziele für Figuren und Gebäude: Beim Bombardement leuchten bombardierbare Planeten
 * rot, bei der Landung grün, bei der Infrastruktur golden. Ein Antippen ohne getragenes Stück
 * gibt dem Planeten die nächste Figur bzw. setzt oder nimmt ein Gebäude; wird eine Figur
 * getragen, legt ein Antippen sie hier ab. Anders als die Bezahlringe sind diese Ringe Knöpfe,
 * denn Figuren und Gebäude haben keinen zweiten Weg über die Planetenreihe. Wird eine
 * Aktionskarte aus der Hand getragen, leuchten stattdessen nur ihre Planeten kühl weiß-blau,
 * auch ganz ohne Tischentscheidung; ein Antippen spielt die Karte dort aus.
 */

/** Ein Planet als Ziel wurde angetippt. */
export type SiteHandler = (planet: PlanetId) => void;

export type SiteKind = 'bombard' | 'landing' | 'construction' | 'card';

const KINDS: Partial<Record<TableSpecId, SiteKind>> = {
  bombard: 'bombard',
  landing: 'landing',
  construction: 'construction',
};

const LABELS: Readonly<Record<SiteKind, MessageKey>> = {
  bombard: 'siteBombard',
  landing: 'siteLand',
  construction: 'siteBuild',
  card: 'siteCard',
};

/** Die Beschriftung nennt den Planeten, auch wenn der Text keinen Platzhalter hat. */
function labelOf(t: (key: MessageKey) => string, kind: SiteKind, planet: string): string {
  const text = t(LABELS[kind]);
  return text.includes('{planet}') ? text.replace('{planet}', planet) : `${text}: ${planet}`;
}

/** Etwas größer als der Bezahlring, damit beide Ringe zugleich sichtbar bleiben. */
const MIN_RADIUS = 15;
const RING_GAP = 7;

interface Site {
  readonly anchor: PlanetAnchor;
  readonly id: PlanetId;
  readonly decided: TargetState;
}

/** Alle Planeten, die die Entscheidung (oder das getragene Stück) als Ziel führt. */
function sitesOf(
  hexes: readonly SceneHex[],
  view: BoardView,
  states: ReadonlyMap<string, TargetState>,
): Site[] {
  return hexes.flatMap((hex) =>
    planetAnchors(hex, view).flatMap((anchor) => {
      const id = planetId(anchor.planet.id);
      const decided = states.get(targetKey(siteTarget(id)));
      return decided === undefined || decided === 'blocked' ? [] : [{ anchor, id, decided }];
    }),
  );
}

/** Wie viele Figuren oder Gebäude der Entwurf diesem Planeten gibt. */
function countAt(decision: TableDecision, planet: PlanetId): number {
  const { draft } = decision;
  if (draft?.kind === 'construction')
    return draft.placements.filter((placement) => placement.planet === planet).length;
  return decision.pieces.filter((piece) => piece.at === planet).length;
}

interface RingProps {
  readonly site: Site;
  readonly kind: SiteKind;
  readonly count: number;
  readonly router: DropHandler;
  readonly onSite: SiteHandler;
}

/** Enter und Leertaste wirken wie ein Klick. */
const enterTo = (run: () => void) => (event: KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  run();
};

/** Die Zahl der zugewiesenen Figuren oben rechts am Ring. */
function SiteCount({ site, count }: { readonly site: Site; readonly count: number }) {
  if (count === 0) return null;
  const { at, radius } = site.anchor;
  const offset = Math.max(MIN_RADIUS, radius + RING_GAP) * 0.75;
  return (
    <text className="site-count" x={at.x + offset} y={at.y - offset} aria-hidden="true">
      {count}
    </text>
  );
}

/** Ein Ring als Knopf; beim Tragen übernehmen die Ablage-Handler des Ziels Klick und Enter. */
function SiteRing({ site, kind, count, router, onSite }: RingProps): ReactElement {
  const t = useT();
  const { anchor, id } = site;
  const target = useTarget(siteTarget(id), site.decided, router);
  const { onClick, onKeyDown, ...marks } = target.props;
  const label = labelOf(t, kind, anchor.planet.name);
  const pick = () => onSite(id);
  return (
    <g className="site">
      <circle
        className={`site-target target-${target.state}${target.over ? ' target-over' : ''}`}
        cx={anchor.at.x}
        cy={anchor.at.y}
        r={Math.max(MIN_RADIUS, anchor.radius + RING_GAP)}
        data-site-kind={kind}
        data-planet={id}
        role="button"
        tabIndex={0}
        aria-label={label}
        {...marks}
        onClick={onClick ?? pick}
        onKeyDown={onKeyDown ?? enterTo(pick)}
      >
        <title>{label}</title>
      </circle>
      <SiteCount site={site} count={count} />
    </g>
  );
}

const kindOf = (decision: TableDecision | null): SiteKind | undefined =>
  decision?.specId == null ? undefined : KINDS[decision.specId];

/** Planeten einer getragenen Aktionskarte, alle erlaubt; `null`, solange keine getragen wird. */
function useCardSites(): ReadonlyMap<string, TargetState> | null {
  const carried = useCarryStore((state) => state.piece?.kind === 'action');
  const legal = useCarryStore((state) => state.legal);
  if (!carried) return null;
  const sites = [...legal].filter((key) => key.startsWith('site:'));
  return new Map(sites.map((key) => [key, 'legal' as const]));
}

export interface SiteTargetsProps {
  readonly game: GameState;
  readonly hexes: readonly SceneHex[];
  readonly view: BoardView;
  /** Ohne eigenen Handler wirkt ein Klick direkt auf den Entwurf (ohne Schutz vor Ziehen). */
  readonly onSite?: SiteHandler | undefined;
}

/**
 * Ringe um alle Planeten, die Bombardement, Landung, Infrastruktur oder die getragene
 * Aktionskarte anbieten, in derselben Ebene wie die Felder und über ihnen. `memo`: Schwenken
 * und Zoomen zeichnen sie nicht neu.
 */
export const SiteTargets = memo(function SiteTargets({
  game,
  hexes,
  view,
  onSite,
}: SiteTargetsProps): ReactElement | null {
  const decision = useTableDecision(game);
  const states = useTableTargets(game);
  const router = useDropRouter(game);
  const card = useCardSites();
  const kind = card === null ? kindOf(decision) : 'card';
  if (kind === undefined) return null;
  const pick = onSite ?? ((planet: PlanetId) => decision?.act({ kind: 'site', planet }));
  return (
    <g className="site-targets" data-site-kind={kind}>
      {sitesOf(hexes, view, card ?? states).map((site) => (
        <SiteRing
          key={site.id}
          {...{ site, kind, router }}
          count={card === null && decision !== null ? countAt(decision, site.id) : 0}
          onSite={pick}
        />
      ))}
    </g>
  );
});
