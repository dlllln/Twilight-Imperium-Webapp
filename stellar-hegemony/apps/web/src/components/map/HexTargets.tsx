import { currentActor, findPlayer, type GameState, type PlayerId } from '@stellar/domain';
import { type CSSProperties, forwardRef, type KeyboardEvent, memo, type ReactElement } from 'react';
import { useGameStore, useViewer } from '../../game-store.ts';
import { type Bounds, hexToPixel, toSvgPoints } from '../../hex-geometry.ts';
import { type BoardView, projectedCorners } from '../../render/board-view.ts';
import type { SceneHex } from '../../render/scene-model.ts';
import { systemActions } from '../../hud/system-actions.ts';
import { seatColor } from '../../seat-colors.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { useGalaxyStore, type Viewport } from '../../store.ts';
import {
  type DropHandler,
  systemTarget,
  targetKey,
  type TargetState,
} from '../../table/target-ref.ts';
import { useDropRouter } from '../../table/use-drop-router.ts';
import { takesSite } from '../../table/table-specs.ts';
import { useTableDecision, useTableTargets } from '../../table/use-table-decision.ts';
import { type TargetView, useTarget } from '../../table/use-target.ts';
import { SystemActions } from '../hud/SystemActions.tsx';
import { type PlanetHandler, PlanetTargets } from './PlanetTargets.tsx';
import { type SiteHandler, SiteTargets } from './SiteTargets.tsx';

/*
 * Unsichtbare Trefferflächen über dem Pixi-Bild: Klick und Tastatur wählen ein System, und
 * jedes System ist zugleich Ablageziel für getragene Stücke (Taktikmarker, Kriegsführung).
 */

/** Wählt ein Feld; mit `point` zeigt man es den Mitspielern (Umschalttaste). */
export type PickHandler = (hex: SceneHex, point?: boolean) => void;

export interface Band {
  readonly top: number;
  readonly bottom: number;
}

interface HexProps {
  readonly hex: SceneHex;
  readonly view: BoardView;
  readonly hovered: boolean;
  readonly onHover: (key: string | null) => void;
  readonly onPick: PickHandler;
}

interface FieldProps extends HexProps {
  readonly targets: ReadonlyMap<string, TargetState>;
  readonly router: DropHandler;
}

const tileClass = (hex: SceneHex): string =>
  hex.kind === 'homeSlot' || hex.back === 'home' ? 'tile-home' : `tile-${hex.back}`;

function classOf(hex: SceneHex, hovered: boolean, target: TargetView | null): string {
  const base = `hex ${tileClass(hex)} highlight-${hex.highlight}`;
  const marks = [
    hovered ? 'highlighted' : '',
    target === null || target.state === 'none' ? '' : `target-${target.state}`,
    target?.over === true ? 'target-over' : '',
  ];
  return [base, ...marks.filter((mark) => mark !== '')].join(' ');
}

/** Enter und Leertaste wählen das Feld wie ein Klick; mit Umschalttaste zeigen sie es. */
const enterToPick = (hex: SceneHex, onPick: PickHandler) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') onPick(hex, event.shiftKey);
};

/** Kennzeichen, auf die sich E2E-Tests, Tests und Screenreader verlassen. */
function hexAttributes(hex: SceneHex) {
  const pickable = hex.systemId !== null;
  return {
    'data-slot': hex.key,
    'data-system': hex.systemId ?? undefined,
    'data-anomaly': hex.anomaly,
    'data-seat': hex.seat ?? undefined,
    'data-planets': hex.planets.length,
    role: pickable ? 'button' : undefined,
    'aria-label': hex.systemId ?? `${hex.kind} ${String(hex.seat)}`,
    tabIndex: pickable ? 0 : undefined,
  };
}

/** Ein Feld; beim Tragen ersetzen die Ablage-Handler des Ziels Klick und Enter. */
function HexPolygon(props: HexProps & { readonly target: TargetView | null }): ReactElement {
  const { hex, view, hovered, onHover, onPick, target } = props;
  const { onClick, onKeyDown, ...marks } = target?.props ?? {};
  return (
    <polygon
      points={toSvgPoints(projectedCorners(view, hexToPixel(hex.position)))}
      className={classOf(hex, hovered, target)}
      {...hexAttributes(hex)}
      {...marks}
      onPointerEnter={() => onHover(hex.key)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(hex.key)}
      onClick={onClick ?? ((event) => onPick(hex, event.shiftKey))}
      onKeyDown={onKeyDown ?? enterToPick(hex, onPick)}
    />
  );
}

/** Ein System als Ablageziel. */
function SystemHex({ targets, router, ...props }: FieldProps & { readonly id: string }) {
  const ref = systemTarget(props.id);
  const target = useTarget(ref, targets.get(targetKey(ref)), router);
  return <HexPolygon {...props} target={target} />;
}

/** Trefferfläche je Feld: Maus, Tastatur, Screenreader, Ablage und E2E-Tests. */
export function HexTarget(props: FieldProps): ReactElement {
  const id = props.hex.systemId;
  if (id === null) return <HexPolygon {...props} target={null} />;
  return <SystemHex {...props} id={id} />;
}

interface FieldsProps {
  readonly game: GameState | null;
  readonly hexes: readonly SceneHex[];
  readonly view: BoardView;
  readonly router: DropHandler;
  readonly onPick: PickHandler;
}

function HexFields({ game, hexes, view, router, onPick }: FieldsProps): ReactElement {
  const hovered = useGalaxyStore((state) => state.hovered);
  const hover = useGalaxyStore((state) => state.hover);
  const targets = useTableTargets(game);
  return (
    <>
      {hexes.map((hex) => (
        <HexTarget
          key={hex.key}
          {...{ hex, view, targets, router, onPick }}
          hovered={hex.key === hovered}
          onHover={hover}
        />
      ))}
    </>
  );
}

const NO_DROP: DropHandler = () => false;

/** Vor der Partie gibt es nichts zu tragen; `memo`: Schwenken und Zoomen zeichnen die Felder nicht neu. */
const PlainFields = memo(function PlainFields(props: Omit<FieldsProps, 'router' | 'game'>) {
  return <HexFields {...props} game={null} router={NO_DROP} />;
});

/** In der Partie legt der Router getragene Stücke ab; `memo` wie bei `PlainFields`. */
const RoutedFields = memo(function RoutedFields(
  props: Omit<FieldsProps, 'router'> & { readonly game: GameState },
) {
  return <HexFields {...props} router={useDropRouter(props.game)} />;
});

export interface TargetsProps {
  readonly hexes: readonly SceneHex[];
  readonly bounds: Bounds;
  readonly band: Band;
  readonly viewport: Viewport;
  readonly view: BoardView;
  readonly onPick: PickHandler;
  readonly onView: (hex: SceneHex) => void;
  /** Klick auf einen angebotenen Planeten (Bezahlung, Bereitmachen). */
  readonly onPlanet?: PlanetHandler | undefined;
  /** Klick auf einen Planeten als Ziel (Bombardement, Landung, Infrastruktur). */
  readonly onSite?: SiteHandler | undefined;
}

const viewBoxOf = (b: Bounds): string =>
  [b.minX, b.minY, b.width, b.height].map((value) => String(value)).join(' ');

type ChosenProps = Omit<TargetsProps, 'onPick' | 'onPlanet' | 'onSite'>;

/**
 * Tischansicht: Ist nichts gewählt, stehen die Knöpfe über dem aktivierten System, solange dort
 * am Ende der taktischen Aktion ein Grenzmarker erkundet werden kann.
 */
function useExploreHex(game: GameState | null, hexes: readonly SceneHex[]): SceneHex | undefined {
  const table = useSettingsStore((state) => state.tableView);
  const me = useViewer();
  if (game === null || !table || currentActor(game) !== me) return undefined;
  return exploreHexOf(game, me, hexes);
}

function exploreHexOf(
  game: GameState,
  me: PlayerId | null,
  hexes: readonly SceneHex[],
): SceneHex | undefined {
  const active = game.actionPhase?.tactical?.system;
  if (active === undefined || !systemActions(game, me, active, false, true).includes('explore'))
    return undefined;
  return hexes.find((hex) => hex.systemId === active);
}

/**
 * Knöpfe über dem in der Partie gewählten System, sonst über dem System zum Erkunden. Solange
 * Figuren oder Gebäude auf Planeten gelegt werden, treten sie zurück: Sie lägen auf den Ringen.
 */
export function ChosenActions({ hexes, band, viewport, view, onView }: ChosenProps) {
  const game = useGameStore((state) => state.game);
  const selected = useGameStore((state) => state.selected);
  const explore = useExploreHex(game, hexes);
  const placing = takesSite(useTableDecision(game)?.specId ?? null);
  const picked = hexes.find((hex) => hex.systemId !== null && hex.systemId === selected);
  const chosen = picked ?? explore;
  if (game === null || chosen === undefined || placing) return null;
  return (
    <SystemActions
      game={game}
      hex={chosen}
      viewport={viewport}
      view={view}
      top={band.top}
      bottom={band.bottom}
      onView={onView}
    />
  );
}

/** Sitzfarbe des eigenen Platzes, damit erlaubte Ziele in ihr leuchten; ohne Platz Gold. */
function useSeatStyle(game: GameState | null): CSSProperties | undefined {
  const viewer = useViewer();
  const player = game === null || viewer === null ? undefined : findPlayer(game, viewer);
  if (player === undefined) return undefined;
  return { '--seat': seatColor(player.seat + 1) } as CSSProperties;
}

/** SVG-Ebene über dem Pixi-Bild, mit derselben Abbildung wie `worldTransform`. */
export const HexTargets = forwardRef<SVGSVGElement, TargetsProps>(function HexTargets(
  { hexes, bounds, band, viewport, view, onPick, onView, onPlanet, onSite },
  svg,
): ReactElement {
  const game = useGameStore((state) => state.game);
  const { panX, panY, zoom } = viewport;
  const fields = { hexes, view, onPick };
  const seat = useSeatStyle(game);
  return (
    <svg ref={svg} viewBox={viewBoxOf(bounds)} aria-label="galaxy" style={seat}>
      <g transform={`translate(${String(panX)} ${String(panY)}) scale(${String(zoom)})`}>
        {game === null ? <PlainFields {...fields} /> : <RoutedFields {...fields} game={game} />}
        {game !== null && <PlanetTargets {...{ game, hexes, view, onPlanet }} />}
        {game !== null && <SiteTargets {...{ game, hexes, view, onSite }} />}
      </g>
      <ChosenActions {...{ hexes, bounds, band, viewport, view, onView }} />
    </svg>
  );
});
