import type { GameState, MapLayout } from '@stellar/domain';
import {
  lazy,
  memo,
  Suspense,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type MapEffect, mapEffects } from '../animation/map-effects.ts';
import { useGameStore } from '../game-store.ts';
import { type Bounds, hexToPixel, type Point } from '../hex-geometry.ts';
import {
  boardBounds,
  type BoardView,
  foreshorten,
  project,
  sameView,
} from '../render/board-view.ts';
import { useBoardView } from '../system/board-camera.ts';
import type { Language } from '../i18n.ts';
import { gameScene, layoutScene, type SceneHex } from '../render/scene-model.ts';
import { content, useGalaxyStore } from '../store.ts';
import { highlightsOf, movementChoices } from '../tactical-view.ts';
import { useSettingsStore } from '../settings-store.ts';
import { usePanZoom } from '../use-pan-zoom.ts';
import { HexTooltip } from './HexTooltip.tsx';
import { MapControls } from './MapControls.tsx';
import { glideCamera, useCameraStore } from '../system/camera-store.ts';
import { freeArea, frameBounds, freeBand, hudInsets, type Insets } from '../system/map-frame.ts';
import { type Size, useElementSize } from '../system/use-element-size.ts';
import {
  boundsCenter,
  CLOSE_ZOOM,
  focusViewport,
  systemZoom,
  zoomAround,
} from '../system/viewport-tween.ts';
import { CloseUpLabels } from './CloseUpLabels.tsx';
import { HandDock } from './hand/HandDock.tsx';
import { PhaseDock } from './hud/PhaseDock.tsx';
import { PlayerRail } from './hud/PlayerRail.tsx';
import { ResourceBar } from './hud/ResourceBar.tsx';
import { PlayerSheet } from './sheet/PlayerSheet.tsx';
import { NoticeStack } from './hud/NoticeStack.tsx';
import { type Band, HexTargets } from './map/HexTargets.tsx';
import { usePicking, usePlanetPicking, useSitePicking } from './map/use-picking.ts';
import { TokenGhosts } from './map/TokenGhosts.tsx';
import { UnitChips } from './map/UnitChips.tsx';
import { framingOf } from '../table/camera-intent.ts';
import { type FramingArea, framingViewport } from '../system/framing.ts';
import { useCarryStore } from '../table/carry-store.ts';
import { withTableHighlights } from '../table/table-highlights.ts';
import type { TargetState } from '../table/target-ref.ts';
import { useTableDecision, useTableTargets } from '../table/use-table-decision.ts';
import { type LiftedToken, liftedTokenOf, withoutLifted } from '../table/lifted-token.ts';
import { useMapPointer } from '../system/map-pointer.ts';
import { GalaxyAmbience } from './GalaxyAmbience.tsx';
import { FleetPieces } from './pieces/FleetPieces.tsx';
import { TabletopMapMotion } from './pieces/TabletopMapMotion.tsx';
import { MapPings } from './MapPings.tsx';
import { TabletopZones } from './tabletop/TabletopZones.tsx';
import { ObjectiveStrip } from './table/ObjectiveStrip.tsx';
import type { FleetProjection } from '../system/fleet-placement.ts';

/** Pixi wird nachgeladen, damit die Oberfläche sofort erscheint. */
const PixiCanvas = lazy(() =>
  import('./PixiCanvas.tsx').then((module) => ({ default: module.PixiCanvas })),
);

interface SceneInput {
  readonly layout: MapLayout;
  readonly game: GameState | null;
  readonly selected: string | null;
  readonly language: Language;
  readonly targets: ReadonlyMap<string, TargetState>;
  readonly lifted: LiftedToken | null;
}

function sceneFor(input: SceneInput): readonly SceneHex[] {
  const { layout, game, selected, language, targets } = input;
  if (game === null) return layoutScene(layout, content, language);
  const base = highlightsOf(game, movementChoices(game, content), selected);
  const shown = withoutLifted(game, input.lifted);
  return gameScene(shown, content, language, withTableHighlights(base, targets));
}

/** Der von der Kriegsführung aufgenommene Marker; dieselbe Abbildung, solange er derselbe bleibt. */
function useLifted(game: GameState | null): LiftedToken | null {
  const lifted = liftedTokenOf(useTableDecision(game));
  const system = lifted?.system ?? null;
  const player = lifted?.player ?? null;
  return useMemo(
    () => (system === null || player === null ? null : { system, player }),
    [system, player],
  );
}

const signatureOf = (targets: ReadonlyMap<string, TargetState>): string =>
  [...targets].map(([key, state]) => `${key}=${state}`).join('|');

/**
 * Ziele der Entscheidung für die Karte. Die Abbildung entsteht bei jedem Zeichnen neu; sie
 * bleibt dieselbe, solange sich nichts ändert, damit Kamerafahrten die Szene nicht neu bauen.
 */
function useMapTargets(game: GameState | null): ReadonlyMap<string, TargetState> {
  const targets = useTableTargets(game);
  const signature = signatureOf(targets);
  // Bewusst nur die Signatur als Abhängigkeit: gleiche Ziele, gleiche Abbildung.
  return useMemo(() => targets, [signature]);
}

/** Szene aus Galaxie-Layout (Aufbau) oder Spielzustand (Partie); Ziele leuchten auf der Karte. */
function useScene(): readonly SceneHex[] {
  const layout = useGalaxyStore((state) => state.layout);
  const language = useGalaxyStore((state) => state.language);
  const game = useGameStore((state) => state.game);
  const selected = useGameStore((state) => state.selected);
  const targets = useMapTargets(game);
  const lifted = useLifted(game);
  return useMemo(
    () => sceneFor({ layout, game, selected, language, targets, lifted }),
    [layout, game, selected, language, targets, lifted],
  );
}

const NO_EFFECTS: readonly MapEffect[] = [];
const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

interface MapFrame {
  readonly bounds: Bounds;
  /** Freies Band zwischen Vorräten und Hand (viewBox), für die Knöpfe am System. */
  readonly band: Band;
  /** Freier Bereich zwischen allen Anzeigen (viewBox), für „Aktion ins Bild“. */
  readonly free: Bounds;
}

/**
 * In der Partie liegt die Karte ganz im freien Bereich zwischen den Anzeigen; in der
 * Tischansicht sitzt sie unten auf dem Kommandopult auf.
 */
function useFrame(hexes: readonly SceneHex[], view: BoardView, size: Size): MapFrame {
  const playing = useGameStore((state) => state.game !== null);
  const table = useSettingsStore((state) => state.tableView);
  const { width, height } = size;
  return useMemo(() => {
    const board = boardBounds(
      view,
      hexes.map((hex) => hexToPixel(hex.position)),
    );
    const screen = { width, height };
    if (!playing) return { bounds: board, band: freeBand(board, screen, NO_INSETS), free: board };
    const insets = hudInsets(board, screen, table ? 'table' : 'classic');
    const bounds = frameBounds(board, screen, insets, table ? 'bottom' : 'center');
    return {
      bounds,
      band: freeBand(bounds, screen, insets),
      free: freeArea(bounds, screen, insets),
    };
  }, [hexes, view, playing, table, width, height]);
}

/** Effekte des letzten Zugs, wenn Animationen eingeschaltet sind. */
function useMapEffects(): readonly MapEffect[] {
  const last = useGameStore((state) => state.lastEvents);
  const animations = useSettingsStore((state) => state.animations);
  return useMemo(
    () => (animations && last !== null ? mapEffects(last.before, last.events) : NO_EFFECTS),
    [animations, last],
  );
}

const svgSize = (svg: RefObject<SVGSVGElement | null>) => ({
  width: svg.current?.clientWidth ?? 0,
  height: svg.current?.clientHeight ?? 0,
});

/** Fährt an ein System heran, bis es gut die Hälfte des Bildes füllt; in der Partie bleibt es gewählt. */
function useFlyTo(bounds: Bounds, view: BoardView, svg: RefObject<SVGSVGElement | null>) {
  return useCallback(
    (hex: SceneHex) => {
      if (hex.kind !== 'system') return;
      const { game, select } = useGameStore.getState();
      if (game !== null) select(hex.systemId);
      const at = project(view, hexToPixel(hex.position));
      const zoom = systemZoom(bounds, svgSize(svg), at.scale, foreshorten(view));
      useCameraStore.getState().focus(focusViewport(bounds, at, zoom));
    },
    [bounds, view, svg],
  );
}

/** Bildschirmpunkt in viewBox-Koordinaten (null, wenn der Browser es nicht kann, z. B. in Tests). */
function toViewBox(svg: SVGSVGElement | null, client: Point): Point | null {
  if (svg === null || !('getScreenCTM' in svg)) return null;
  const matrix = svg.getScreenCTM();
  if (matrix === null) return null;
  const point = new DOMPoint(client.x, client.y).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

/** Stufenloser Zoom zum Zeiger hin (ohne Zeiger zur Bildmitte), bis an einzelne Planeten. */
function useZoom(bounds: Bounds, svg: RefObject<SVGSVGElement | null>) {
  return (factor: number, client?: Point) => {
    const pointed = client === undefined ? null : toViewBox(svg.current, client);
    const anchor = pointed ?? boundsCenter(bounds);
    glideCamera((from) => zoomAround(from, factor, anchor));
  };
}

/** Escape fährt nach dem Heranfahren an die alte Stelle zurück; beim Tragen legt es nur zurück. */
function useEscapeBack(): void {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (useCarryStore.getState().piece !== null) return;
      const { returnTo, back } = useCameraStore.getState();
      if (event.key === 'Escape' && returnTo !== null) back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Gesten der Anzeigen über der Karte sollen die Karte darunter nicht verschieben. */
const shield = { onPointerDown: stop, onPointerMove: stop, onWheel: stop, onDoubleClick: stop };
function stop(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

/**
 * Anzeigen der Partie über der Karte: Spieler, Vorräte, Phase, offene Entscheidungen, Hand.
 * In der Tischansicht liegen die eigenen Vorräte als Kommandopult unten statt als Leiste oben.
 */
function Hud({ game, table }: { readonly game: GameState; readonly table: boolean }): ReactElement {
  return (
    <>
      <TabletopZones game={game} />
      {table && <ObjectiveStrip game={game} />}
      <PlayerRail game={game} />
      {table ? <PlayerSheet game={game} /> : <ResourceBar game={game} />}
      <div className="hud-corner">
        <NoticeStack game={game} />
        <PhaseDock game={game} />
      </div>
      <HandDock game={game} />
    </>
  );
}

/**
 * Oberhalb der Karte: die Anzeigen der Partie; ihre Gesten verschieben die Karte nicht.
 * `data-carrying` zeigt beim Tragen eines Stücks die greifende Hand.
 * Ohne Eigenschaften und mit `memo`: Kamerafahrten und Drehungen der Karte zeichnen sie nicht neu.
 * `data-view` wählt die Anordnung im Stylesheet (klassisch oder Tischansicht).
 */
const Overlays = memo(function Overlays(): ReactElement | null {
  const game = useGameStore((state) => state.game);
  const table = useSettingsStore((state) => state.tableView);
  const carrying = useCarryStore((state) => state.piece !== null);
  if (game === null) return null;
  return (
    <div
      className="hud-shield"
      data-view={table ? 'table' : 'classic'}
      data-carrying={carrying ? 'true' : undefined}
      {...shield}
    >
      <Hud game={game} table={table} />
    </div>
  );
});

/** Kamera der Karte: Heranfahren an Systeme und stufenloser Zoom, beide über dieselbe SVG-Abbildung. */
function useMapCamera(bounds: Bounds, view: BoardView, svg: RefObject<SVGSVGElement | null>) {
  const flyTo = useFlyTo(bounds, view, svg);
  const zoom = useZoom(bounds, svg);
  useEscapeBack();
  return { flyTo, zoom };
}

/** Ohne WebGL zeigt die Karte nur die SVG-Felder. */
function useFlatFallback(): readonly [boolean, () => void] {
  const [flat, setFlat] = useState(false);
  return [flat, useCallback(() => setFlat(true), [])];
}

/**
 * Hinweis am Zeiger; beim Nahzoom übernehmen die Schilder an Planeten und Flotten, am Tablet die
 * Knöpfe. Solange ein Stück getragen wird, schweigt er: Der Zeiger gehört dann dem Stück.
 */
function MapTooltip({ hexes }: { readonly hexes: readonly SceneHex[] }) {
  const hovered = useGalaxyStore((state) => state.hovered);
  const zoom = useGalaxyStore((state) => state.viewport.zoom);
  const cursor = useMapPointer((state) => state.cursor);
  const touch = useMapPointer((state) => state.touch);
  const carrying = useCarryStore((state) => state.piece !== null);
  const hex = hexes.find((candidate) => candidate.key === hovered);
  // Mit dem Finger gibt es kein Zeigen ohne Tippen: dort übernehmen Knöpfe und Nahzoom.
  if (hex === undefined || touch || carrying || zoom >= CLOSE_ZOOM) return null;
  return <HexTooltip hex={hex} x={cursor.x} y={cursor.y} />;
}

/**
 * Beim Ziehen hält das Stück den Zeiger fest, die Karte erfährt nichts von seinen Bewegungen.
 * Nach dem Loslassen bekommt sie den letzten Punkt, damit ein Hinweis dort erscheint und nicht
 * an einer veralteten Stelle (etwa oben links).
 */
function useDropPointer(svg: RefObject<SVGSVGElement | null>): void {
  useEffect(
    () =>
      useCarryStore.subscribe((state, before) => {
        if (state.piece !== null || before.point === null) return;
        const box = svg.current?.closest('.galaxy')?.getBoundingClientRect();
        if (box === undefined) return;
        const cursor = { x: before.point.x - box.left, y: before.point.y - box.top };
        useMapPointer.setState({ cursor });
      }),
    [svg],
  );
}

/** Blick, Bildausschnitt und Kamera der Karte. */
function useMapView(hexes: readonly SceneHex[]) {
  const { view, target } = useBoardView(hexes);
  const svg = useRef<SVGSVGElement>(null);
  const size = useElementSize(svg);
  const { bounds, band, free } = useFrame(hexes, target, size);
  useDropPointer(svg);
  const attributes = {
    'data-tutorial': 'galaxy',
    'data-board-settled': sameView(view, target),
  };
  const area: FramingArea = { bounds, free, size };
  return { view, svg, size, bounds, band, area, attributes, ...useMapCamera(bounds, view, svg) };
}

function BoardObjects(props: FleetProjection) {
  return (
    <>
      <CloseUpLabels {...props} />
      <MapPings {...props} />
      <TabletopMapMotion {...props} />
      <FleetPieces {...props} />
      <TokenGhosts {...props} />
      <UnitChips {...props} />
    </>
  );
}

/** Klicks auf Felder, angebotene Planeten und Planeten als Ziel; wer die Karte zieht, wählt nichts. */
function useMapPicking(wasDrag: () => boolean, flyTo: (hex: SceneHex) => void) {
  return {
    onPick: usePicking(wasDrag, flyTo),
    onPlanet: usePlanetPicking(wasDrag),
    onSite: useSitePicking(wasDrag),
  };
}

/** Systeme, die die laufende Entscheidung auf der Karte betrifft; dieselben, solange sie gilt. */
function useFramedSystems() {
  const game = useGameStore((state) => state.game);
  const route = useTableDecision(game)?.route ?? null;
  const targets = useMapTargets(game);
  const key = route?.key ?? null;
  // Die Route entsteht bei jedem Zeichnen neu; ihr Schlüssel sagt, ob sie dieselbe ist.
  return useMemo(
    () => (game === null ? [] : framingOf(game, route, targets)),
    [game, key, targets],
  );
}

/**
 * „Aktion ins Bild“: Nur wenn die Entscheidung Systeme auf der Karte hat, gibt es den Knopf. Die
 * Kamera fährt erst auf Knopfdruck und merkt sich, woher sie kam (Escape fährt zurück).
 */
function useFrameAction(view: BoardView, hexes: readonly SceneHex[], area: FramingArea) {
  const systems = useFramedSystems();
  if (systems.length === 0) return undefined;
  return () => {
    const to = framingViewport(area, view, hexes, systems);
    if (to !== null) useCameraStore.getState().focus(to);
  };
}

interface FramedProps {
  readonly view: BoardView;
  readonly hexes: readonly SceneHex[];
  readonly area: FramingArea;
  readonly onZoom: (factor: number) => void;
}

/** Kartensteuerung samt „Aktion ins Bild“, solange es etwas zu rahmen gibt. */
function FramedControls({ view, hexes, area, onZoom }: FramedProps): ReactElement {
  const onFrame = useFrameAction(view, hexes, area);
  return (
    <MapControls
      onZoom={(factor) => onZoom(factor)}
      onReset={useCameraStore.getState().back}
      onFrame={onFrame}
    />
  );
}

export function GalaxyMap(): ReactElement {
  const viewport = useGalaxyStore((state) => state.viewport);
  const hexes = useScene();
  const effects = useMapEffects();
  const { view, svg, size, bounds, band, area, attributes, flyTo, zoom } = useMapView(hexes);
  const { wasDrag, ...handlers } = usePanZoom(svg, bounds.width, zoom);
  const [flat, onUnavailable] = useFlatFallback();
  const picking = useMapPicking(wasDrag, flyTo);
  return (
    <div className={flat ? 'galaxy flat' : 'galaxy'} {...attributes} {...handlers}>
      {!flat && (
        <Suspense fallback={null}>
          <PixiCanvas {...{ hexes, bounds, viewport, view, effects, onUnavailable }} />
        </Suspense>
      )}
      <GalaxyAmbience sectors={hexes.length} />
      <HexTargets
        {...{ hexes, bounds, band, viewport, view }}
        ref={svg}
        {...picking}
        onView={flyTo}
      />
      <BoardObjects {...{ hexes, bounds, viewport, view, size }} />
      <MapTooltip hexes={hexes} />
      <FramedControls {...{ view, hexes, area }} onZoom={zoom} />
      <Overlays />
    </div>
  );
}
